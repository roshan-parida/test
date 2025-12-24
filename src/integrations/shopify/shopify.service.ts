import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Store } from '../../stores/schemas/store.schema';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditStatus } from '../../audit/schemas/audit-log.schema';

interface DailyOrdersSummary {
	date: string;
	soldOrders: number;
	orderValue: number;
	soldItems: number;
}

interface ProductSalesData {
	productId: string;
	productName: string;
	productImage: string;
	productUrl: string;
	quantitySold: number;
	revenue: number;
}

interface TrafficAnalyticsData {
	landingPageType: string;
	landingPagePath: string;
	onlineStoreVisitors: number;
	sessions: number;
	sessionsWithCartAdditions: number;
	sessionsThatReachedCheckout: number;
}

@Injectable()
export class ShopifyService {
	private readonly logger = new Logger(ShopifyService.name);

	constructor(private readonly auditService: AuditService) {}

	private async callShopify(store: Store, query: string, variables: any) {
		const url = `https://${store.shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

		try {
			const response = await axios.post(
				url,
				{ query, variables },
				{
					headers: {
						'X-Shopify-Access-Token': store.shopifyToken,
						'Content-Type': 'application/json',
					},
				},
			);

			if (response.data.errors) {
				this.logger.error(
					`Shopify GraphQL Errors: ${JSON.stringify(response.data.errors)}`,
				);
				throw new Error('Shopify GraphQL error');
			}

			return response.data.data;
		} catch (error) {
			const err = error as AxiosError;
			this.logger.error(`Shopify API Error: ${err.message}`);
			throw err;
		}
	}

	private toISTString(date: Date): string {
		const istOffset = 5.5 * 60 * 60 * 1000;
		const istDate = new Date(date.getTime() + istOffset);
		return istDate.toISOString().replace('Z', '+05:30');
	}

	private getUTCDateString(date: Date): string {
		const year = date.getUTCFullYear();
		const month = String(date.getUTCMonth() + 1).padStart(2, '0');
		const day = String(date.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private getOrdersQuery(): string {
		return `
			query getOrders($cursor: String, $queryString: String!) {
				orders(first: 100, after: $cursor, query: $queryString) {
					edges {
						cursor
						node {
							id
							createdAt
							totalPriceSet { shopMoney { amount } }
							lineItems(first: 100) {
								edges {
									node { 
										quantity
										product {
											id
											title
											onlineStoreUrl
											featuredImage {
												url
											}
										}
									}
								}
							}
						}
					}
					pageInfo { hasNextPage }
				}
			}
		`;
	}

	async fetchOrders(
		store: Store,
		from: Date,
		to: Date,
	): Promise<DailyOrdersSummary[]> {
		try {
			const startTime = Date.now();

			// Log with both UTC and IST for debugging
			this.logger.log(
				`[TIMEZONE DEBUG] fetchOrders called with:
				- from (UTC): ${from.toISOString()}
				- to (UTC): ${to.toISOString()}
				- from (IST): ${this.toISTString(from)}
				- to (IST): ${this.toISTString(to)}`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: {
					from: from.toISOString(),
					to: to.toISOString(),
					fromIST: this.toISTString(from),
					toIST: this.toISTString(to),
				},
			});

			const totalDays =
				Math.ceil(
					(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
				) + 1;

			this.logger.log(
				`Fetching Shopify orders for ${store.name}: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)} (${totalDays} days)`,
			);

			// Query ALL orders in the date range at once
			// Use ISO string format which Shopify understands
			const fromISO = from.toISOString();
			const toISO = to.toISOString();
			const queryString = `created_at:>='${fromISO}' AND created_at:<='${toISO}'`;

			this.logger.debug(`Shopify query: ${queryString}`);

			const ordersMap = new Map<string, DailyOrdersSummary>();
			let cursor: string | null = null;
			let hasNextPage = true;
			let processedOrders = 0;

			while (hasNextPage) {
				const data = await this.callShopify(
					store,
					this.getOrdersQuery(),
					{ cursor, queryString },
				);

				const orders = data.orders.edges;

				for (const order of orders) {
					// Group by day in-memory using UTC date
					const orderDate = new Date(order.node.createdAt);
					const dateKey = this.getUTCDateString(orderDate);

					this.logger.debug(
						`Order ${order.node.id}: createdAt=${order.node.createdAt}, dateKey=${dateKey}`,
					);

					if (!ordersMap.has(dateKey)) {
						ordersMap.set(dateKey, {
							date: dateKey,
							soldOrders: 0,
							orderValue: 0,
							soldItems: 0,
						});
					}

					const daySummary = ordersMap.get(dateKey)!;
					daySummary.soldOrders++;
					daySummary.orderValue += parseFloat(
						order.node.totalPriceSet.shopMoney.amount || '0',
					);

					for (const item of order.node.lineItems.edges) {
						daySummary.soldItems += item.node.quantity;
					}

					processedOrders++;
				}

				hasNextPage = data.orders.pageInfo.hasNextPage;
				cursor = hasNextPage ? orders[orders.length - 1].cursor : null;

				if (processedOrders % 100 === 0) {
					this.logger.log(
						`Progress: ${processedOrders} orders processed for ${store.name}`,
					);
				}
			}

			// Convert map to sorted array
			const results = Array.from(ordersMap.values()).sort((a, b) =>
				a.date.localeCompare(b.date),
			);

			this.logger.log(
				`✓ Retrieved ${results.length} days of orders (${processedOrders} total orders) for ${store.name}`,
			);

			// Log the dates we got data for
			if (results.length > 0) {
				this.logger.log(
					`Date range in results: ${results[0].date} to ${results[results.length - 1].date}`,
				);
			}

			await this.auditService.log({
				action: AuditAction.SHOPIFY_ORDERS_FETCHED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - startTime,
				metadata: {
					daysProcessed: results.length,
					totalDays,
					totalOrders: processedOrders,
					dateRange:
						results.length > 0
							? `${results[0].date} to ${results[results.length - 1].date}`
							: 'no data',
				},
			});

			return results;
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: (error as any).message,
				errorDetails: error,
			});
			throw error;
		}
	}

	async fetchProductSales(
		store: Store,
		from?: Date,
		to?: Date,
	): Promise<ProductSalesData[]> {
		try {
			const startTime = Date.now();
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: {
					from: from ? from.toISOString() : 'all-time',
					to: to ? to.toISOString() : 'all-time',
				},
			});

			let queryString = '';
			if (from && to) {
				const fromISO = from.toISOString();
				const toISO = to.toISOString();
				queryString = `created_at:>='${fromISO}' AND created_at:<='${toISO}'`;
			}

			let cursor: string | null = null;
			let hasNextPage = true;
			const productMap = new Map<string, ProductSalesData>();

			const dateRangeLog =
				from && to
					? `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`
					: 'all-time';

			this.logger.log(
				`Fetching product sales for ${store.name}: ${dateRangeLog}`,
			);

			while (hasNextPage) {
				const data = await this.callShopify(
					store,
					this.getOrdersQuery(),
					{
						cursor,
						queryString,
					},
				);

				const orders = data.orders.edges;

				for (const order of orders) {
					const orderTotal = parseFloat(
						order.node.totalPriceSet.shopMoney.amount || '0',
					);
					const totalItems = order.node.lineItems.edges.reduce(
						(sum: number, item: any) => sum + item.node.quantity,
						0,
					);

					for (const item of order.node.lineItems.edges) {
						const product = item.node.product;
						if (!product) continue;

						const productId = product.id;
						const quantity = item.node.quantity;
						const itemRevenue =
							(quantity / totalItems) * orderTotal;

						if (!productMap.has(productId)) {
							productMap.set(productId, {
								productId,
								productName: product.title,
								productImage: product.featuredImage?.url || '',
								productUrl: product.onlineStoreUrl || '',
								quantitySold: 0,
								revenue: 0,
							});
						}

						const existing = productMap.get(productId)!;
						existing.quantitySold += quantity;
						existing.revenue += itemRevenue;
					}
				}

				hasNextPage = data.orders.pageInfo.hasNextPage;
				cursor = hasNextPage ? orders[orders.length - 1].cursor : null;
			}

			const results = Array.from(productMap.values());
			this.logger.log(
				`✓ Retrieved sales data for ${results.length} products from ${store.name}`,
			);
			await this.auditService.log({
				action: AuditAction.SHOPIFY_PRODUCTS_SYNCED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - startTime,
				metadata: {
					productsProcessed: results.length,
					dateRangeLog: dateRangeLog,
				},
			});

			return results;
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: (error as any).message,
				errorDetails: error,
			});
			throw error;
		}
	}

	async fetchTrafficAnalytics(
		store: Store,
		daysBack: number = 7,
		limit: number = 10,
	): Promise<TrafficAnalyticsData[]> {
		const url = `https://${store.shopifyStoreUrl}/admin/api/2025-10/graphql.json`;

		const shopifyQLQuery = `
			FROM sessions 
			SHOW online_store_visitors, sessions, sessions_with_cart_additions, sessions_that_reached_checkout 
			WHERE landing_page_path IS NOT NULL 
			AND human_or_bot_session IN ('human', 'bot') 
			GROUP BY landing_page_type, landing_page_path 
			WITH TOTALS 
			SINCE startOfDay(-${daysBack}d) 
			UNTIL today 
			ORDER BY sessions DESC 
			LIMIT ${limit}
		`;

		const graphqlQuery = {
			query: `query {
				shopifyqlQuery(query: "${shopifyQLQuery.replace(/\s+/g, ' ').replace(/"/g, '\\"')}") {
					tableData {
						columns { name dataType displayName }
						rows
					}
					parseErrors
				}
			}`,
		};

		try {
			const startTime = Date.now();
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: { daysBack: daysBack, limit: limit },
			});

			const response = await axios.post(url, graphqlQuery, {
				headers: {
					'X-Shopify-Access-Token': store.shopifyToken,
					'Content-Type': 'application/json',
				},
			});

			if (response.data.errors) {
				this.logger.error(
					`Shopify GraphQL Errors: ${JSON.stringify(response.data.errors)}`,
				);
				throw new Error('Shopify GraphQL error');
			}

			const queryData = response.data.data.shopifyqlQuery;

			if (queryData.parseErrors && queryData.parseErrors.length > 0) {
				this.logger.error(
					`ShopifyQL Parse Errors: ${JSON.stringify(queryData.parseErrors)}`,
				);
				throw new Error('ShopifyQL parse error');
			}

			const tableData = queryData.tableData;
			const results: TrafficAnalyticsData[] = [];

			for (const row of tableData.rows) {
				results.push({
					landingPageType: row.landing_page_type || 'Unknown',
					landingPagePath: row.landing_page_path || '/',
					onlineStoreVisitors: parseInt(
						row.online_store_visitors || '0',
						10,
					),
					sessions: parseInt(row.sessions || '0', 10),
					sessionsWithCartAdditions: parseInt(
						row.sessions_with_cart_additions || '0',
						10,
					),
					sessionsThatReachedCheckout: parseInt(
						row.sessions_that_reached_checkout || '0',
						10,
					),
				});
			}

			this.logger.log(
				`✓ Retrieved traffic analytics for ${results.length} landing pages from ${store.name}`,
			);
			await this.auditService.log({
				action: AuditAction.SHOPIFY_TRAFFIC_SYNCED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - startTime,
				metadata: {
					landingPagesProcessed: results.length,
					daysBack: daysBack,
					limit: limit,
				},
			});

			return results;
		} catch (error) {
			const err = error as AxiosError;
			this.logger.error(
				`Shopify Traffic Analytics Error: ${err.message}`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: (err as any).message,
				errorDetails: err,
			});
			throw err;
		}
	}
}
