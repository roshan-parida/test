import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction, AuditStatus } from 'src/audit/schemas/audit-log.schema';
import { Store } from 'src/stores/schemas/store.schema';

interface GeographicalData {
	country: string;
	region: string | null;
	city: string | null;
	sessions: number;
	sessionsCompletedCheckout: number;
	addToCarts: number;
	orders: number;
	revenue: number;
	conversionRate: number;
	averageOrderValue: number;
}

interface SessionData {
	session_country: string;
	session_region: string;
	session_city: string;
	sessions: number;
	sessions_that_completed_checkout: number;
	sessions_with_cart_additions: number;
}

interface SalesData {
	billing_country: string;
	billing_region: string;
	billing_city: string;
	orders: number;
	gross_sales: number;
}

@Injectable()
export class GeoMetricsService {
	private readonly logger = new Logger(GeoMetricsService.name);

	constructor(private readonly auditService: AuditService) {}

	private getGroupByFields(groupBy: 'country' | 'region' | 'city'): {
		sessionFields: string;
		salesFields: string;
	} {
		switch (groupBy) {
			case 'country':
				return {
					sessionFields: 'session_country',
					salesFields: 'billing_country',
				};
			case 'region':
				return {
					sessionFields: 'session_country, session_region',
					salesFields: 'billing_country, billing_region',
				};
			case 'city':
			default:
				return {
					sessionFields:
						'session_country, session_region, session_city',
					salesFields:
						'billing_country, billing_region, billing_city',
				};
		}
	}

	private normalizeLocation(
		country: string,
		region?: string,
		city?: string,
	): string {
		const parts = [country];
		if (region && region !== 'null' && region !== '') parts.push(region);
		if (city && city !== 'null' && city !== '') parts.push(city);
		return parts.join('|').toLowerCase();
	}

	async fetchGeographicalData(
		store: Store,
		startDate: string, // Format: YYYY-MM-DD
		endDate: string, // Format: YYYY-MM-DD
		limit: number,
		groupBy: 'country' | 'region' | 'city' = 'city',
	): Promise<GeographicalData[]> {
		try {
			const queryStartTime = Date.now();
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: {
					startDate,
					endDate,
					limit,
					groupBy,
					type: 'geographical',
				},
			});

			const url = `https://${store.shopifyStoreUrl}/admin/api/2025-10/graphql.json`;
			const groupFields = this.getGroupByFields(groupBy);

			// Query 1: Sessions data
			// ShopifyQL accepts ISO 8601 dates (YYYY-MM-DD)
			const sessionsQuery = `
            FROM sessions
            SHOW sessions, sessions_that_completed_checkout, sessions_with_cart_additions
            WHERE human_or_bot_session IN ('human', 'bot')
            GROUP BY ${groupFields.sessionFields}
            SINCE ${startDate} UNTIL ${endDate}
            ORDER BY sessions DESC
            LIMIT ${limit}
        `;

			// Query 2: Sales data
			const salesQuery = `
            FROM sales
            SHOW orders, gross_sales
            GROUP BY ${groupFields.salesFields}
            SINCE ${startDate} UNTIL ${endDate}
            ORDER BY orders DESC
            LIMIT ${limit}
        `;

			const buildGraphQLQuery = (shopifyQLQuery: string) => ({
				query: `query {
                shopifyqlQuery(query: "${shopifyQLQuery.replace(/\s+/g, ' ').replace(/"/g, '\\"')}") {
                    tableData {
                        columns { name dataType displayName }
                        rows
                    }
                    parseErrors
                }
            }`,
			});

			this.logger.log(
				`Fetching geographical data for ${store.name}: ${startDate} to ${endDate}, grouped by ${groupBy}`,
			);

			// Execute both queries in parallel
			const [sessionsResponse, salesResponse] = await Promise.all([
				axios.post(url, buildGraphQLQuery(sessionsQuery), {
					headers: {
						'X-Shopify-Access-Token': store.shopifyToken,
						'Content-Type': 'application/json',
					},
				}),
				axios.post(url, buildGraphQLQuery(salesQuery), {
					headers: {
						'X-Shopify-Access-Token': store.shopifyToken,
						'Content-Type': 'application/json',
					},
				}),
			]);

			// Validate responses
			if (sessionsResponse.data.errors || salesResponse.data.errors) {
				throw new Error('Shopify GraphQL error');
			}

			const sessionsData =
				sessionsResponse.data.data.shopifyqlQuery.tableData;
			const salesData = salesResponse.data.data.shopifyqlQuery.tableData;

			if (
				(sessionsData.parseErrors &&
					sessionsData.parseErrors.length > 0) ||
				(salesData.parseErrors && salesData.parseErrors.length > 0)
			) {
				this.logger.error('ShopifyQL Parse Errors');
				throw new Error('ShopifyQL parse error');
			}

			// Process and merge data
			const sessionMap = new Map<string, SessionData>();
			const salesMap = new Map<string, SalesData>();

			// Process sessions data
			for (const row of sessionsData.rows) {
				const locationKey = this.normalizeLocation(
					row.session_country || 'Unknown',
					row.session_region,
					row.session_city,
				);

				sessionMap.set(locationKey, {
					session_country: row.session_country || 'Unknown',
					session_region: row.session_region || null,
					session_city: row.session_city || null,
					sessions: parseInt(row.sessions || '0', 10),
					sessions_that_completed_checkout: parseInt(
						row.sessions_that_completed_checkout || '0',
						10,
					),
					sessions_with_cart_additions: parseInt(
						row.sessions_with_cart_additions || '0',
						10,
					),
				});
			}

			// Process sales data
			for (const row of salesData.rows) {
				const locationKey = this.normalizeLocation(
					row.billing_country || 'Unknown',
					row.billing_region,
					row.billing_city,
				);

				salesMap.set(locationKey, {
					billing_country: row.billing_country || 'Unknown',
					billing_region: row.billing_region || null,
					billing_city: row.billing_city || null,
					orders: parseInt(row.orders || '0', 10),
					gross_sales: parseFloat(row.gross_sales || '0'),
				});
			}

			// Merge data
			const allLocations = new Set([
				...sessionMap.keys(),
				...salesMap.keys(),
			]);
			const results: GeographicalData[] = [];

			for (const locationKey of allLocations) {
				const sessionData = sessionMap.get(locationKey);
				const salesData = salesMap.get(locationKey);

				// Extract location parts from the first available source
				const [country, region, city] = locationKey.split('|');

				const sessions = sessionData?.sessions || 0;
				const sessionsCompletedCheckout =
					sessionData?.sessions_that_completed_checkout || 0;
				const addToCarts =
					sessionData?.sessions_with_cart_additions || 0;
				const orders = salesData?.orders || 0;
				const revenue = salesData?.gross_sales || 0;

				results.push({
					country: country || 'Unknown',
					region: region || null,
					city: city || null,
					sessions,
					sessionsCompletedCheckout,
					addToCarts,
					orders,
					revenue: Math.round(revenue * 100) / 100,
					conversionRate:
						sessions > 0
							? Math.round(
									(sessionsCompletedCheckout / sessions) *
										10000,
								) / 100
							: 0,
					averageOrderValue:
						orders > 0
							? Math.round((revenue / orders) * 100) / 100
							: 0,
				});
			}

			// Sort by sessions (descending)
			results.sort((a, b) => b.sessions - a.sessions);

			// Limit results
			const finalResults = results.slice(0, limit);

			this.logger.log(
				`✓ Retrieved geographical data for ${finalResults.length} locations from ${store.name}`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_TRAFFIC_SYNCED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - queryStartTime,
				metadata: {
					locationsProcessed: finalResults.length,
					startDate,
					endDate,
					groupBy,
				},
			});

			return finalResults;
		} catch (error) {
			const err = error as AxiosError;
			this.logger.error(
				`Shopify Geographical Analytics Error: ${err.message}`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: err.message,
				errorDetails: err,
			});

			throw err;
		}
	}
}
