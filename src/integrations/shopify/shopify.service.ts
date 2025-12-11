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
	private readonly DELAY_BETWEEN_DAYS_MS = 100;

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

	private getOrdersQuery(): string {
		return `
			query getOrders($cursor: String, $queryString: String!) {
				orders(first: 100, after: $cursor, query: $queryString) {
					edges {
						cursor
						node {
							id
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

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async fetchOrders(
		store: Store,
		from: Date,
		to: Date,
	): Promise<DailyOrdersSummary[]> {
		try {
			const startTime = Date.now();
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: { from: from.toISOString(), to: to.toISOString() },
			});

			const results: DailyOrdersSummary[] = [];
			const currentDate = new Date(from);
			let dayCount = 0;

			const totalDays =
				Math.ceil(
					(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
				) + 1;

			this.logger.log(
				`Fetching Shopify orders for ${store.name}: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)} (${totalDays} days)`,
			);

			while (currentDate <= to) {
				const dayStart = new Date(currentDate);
				dayStart.setHours(0, 0, 0, 0);

				const dayEnd = new Date(currentDate);
				dayEnd.setHours(23, 59, 59, 999);

				const queryString = `created_at:>='${dayStart.toISOString()}' AND created_at:<='${dayEnd.toISOString()}'`;

				let cursor: string | null = null;
				let hasNextPage = true;
				let soldOrders = 0;
				let orderValue = 0;
				let soldItems = 0;

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
						soldOrders++;
						orderValue += parseFloat(
							order.node.totalPriceSet.shopMoney.amount || '0',
						);

						for (const item of order.node.lineItems.edges) {
							soldItems += item.node.quantity;
						}
					}

					hasNextPage = data.orders.pageInfo.hasNextPage;
					cursor = hasNextPage
						? orders[orders.length - 1].cursor
						: null;
				}

				results.push({
					date: currentDate.toISOString().slice(0, 10),
					soldOrders,
					orderValue,
					soldItems,
				});

				dayCount++;
				if (dayCount % 10 === 0) {
					this.logger.log(
						`Progress: ${dayCount}/${totalDays} days processed for ${store.name}`,
					);
				}

				if (totalDays > 1 && currentDate < to) {
					await this.sleep(this.DELAY_BETWEEN_DAYS_MS);
				}

				currentDate.setDate(currentDate.getDate() + 1);
			}

			this.logger.log(
				`✓ Retrieved ${results.length} days of orders for ${store.name}`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_ORDERS_FETCHED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - startTime,
				metadata: { daysProcessed: results.length, totalDays },
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
					from: from ? from.toISOString() : '',
					to: to ? to.toISOString() : '',
				},
			});

			let queryString = '';
			if (from && to) {
				queryString = `created_at:>='${from.toISOString()}' AND created_at:<='${to.toISOString()}'`;
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
					daysProcessed: results.length,
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
					daysProcessed: results.length,
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
