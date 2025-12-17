import {
	Controller,
	Get,
	Param,
	Post,
	UseGuards,
	Logger,
	Query,
	BadRequestException,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { StoresService } from '../stores/stores.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { ProductMetricsService } from '../analytics/product-metric.service';
import { TrafficMetricsService } from './traffic-metric.service';
import { GeoMetricsService } from './geo-metric.service';

@ApiTags('Shopify Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard, StoreAccessGuard)
export class AnalyticsController {
	private readonly logger = new Logger(AnalyticsController.name);

	constructor(
		private readonly storesService: StoresService,
		private readonly shopifyService: ShopifyService,
		private readonly productMetricsService: ProductMetricsService,
		private readonly trafficMetricsService: TrafficMetricsService,
		private readonly geoMetricsService: GeoMetricsService,
	) {}

	@Get('stores/:storeId/top-products')
	@ApiOperation({
		summary: 'Get top 5 best-performing products for a store',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Number of top products to return (default: 5)',
	})
	@ApiResponse({
		status: 200,
		description: 'Top products retrieved successfully',
		schema: {
			type: 'object',
			properties: {
				storeId: { type: 'string' },
				storeName: { type: 'string' },
				topProducts: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							productId: { type: 'string' },
							productName: { type: 'string' },
							productImage: { type: 'string' },
							totalQuantitySold: { type: 'number' },
							totalRevenue: { type: 'number' },
							lastSyncDate: { type: 'string' },
						},
					},
				},
			},
		},
	})
	@ApiResponse({ status: 404, description: 'Store not found' })
	async getTopProducts(
		@Param('storeId') storeId: string,
		@Query('limit') limit?: number,
	) {
		const store = await this.storesService.findOne(storeId);
		const productLimit = limit && limit > 0 ? limit : 5;

		const topProducts =
			await this.productMetricsService.getTopProductsByStore(
				storeId,
				productLimit,
			);

		return {
			storeId: store._id,
			storeName: store.name,
			topProducts: topProducts.map((p) => ({
				productId: p.productId,
				productName: p.productName,
				productImage: p.productImage,
				productUrl: p.productUrl,
				totalQuantitySold: p.totalQuantitySold,
				totalRevenue: Math.round(p.totalRevenue * 100) / 100,
				lastSyncDate: p.lastSyncDate,
			})),
		};
	}

	@Post('stores/:storeId/sync-products')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({
		summary:
			'Sync product analytics for a store (Admin/Manager only) - defaults to all-time data',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'days',
		required: false,
		type: Number,
		description: 'Number of days to sync (omit for all-time data)',
	})
	@ApiResponse({
		status: 200,
		description: 'Product sync completed successfully',
	})
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async syncProductAnalytics(
		@Param('storeId') storeId: string,
		@Query('days') days?: number,
	) {
		const store = await this.storesService.findOne(storeId);

		const to = new Date();
		to.setHours(23, 59, 59, 999);

		let from: Date | undefined;
		let syncDescription: string;

		if (days && days > 0) {
			from = new Date();
			from.setDate(from.getDate() - days);
			from.setHours(0, 0, 0, 0);
			syncDescription = `last ${days} days`;
		} else {
			// Lifelong: pass undefined/null to Shopify service
			from = undefined;
			syncDescription = 'all-time';
		}

		this.logger.log(
			`Starting product analytics sync for ${store.name} (${syncDescription})`,
		);

		// Reset existing data before fresh sync
		await this.productMetricsService.resetStoreProducts(storeId);

		const productSales = await this.shopifyService.fetchProductSales(
			store,
			from,
			to,
		);

		let processedCount = 0;
		for (const product of productSales) {
			await this.productMetricsService.upsertProductMetric({
				storeId: store._id,
				productId: product.productId,
				productName: product.productName,
				productImage: product.productImage,
				productUrl: product.productUrl,
				quantitySold: product.quantitySold,
				revenue: product.revenue,
			});
			processedCount++;
		}

		this.logger.log(`✓ Product analytics sync completed for ${store.name}`);
		this.logger.log(`Processed ${processedCount} products`);

		return {
			message: `Product analytics synced for store: ${store.name}`,
			dateRange: from
				? `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`
				: 'All-time data',
			productsProcessed: processedCount,
		};
	}

	@Get('stores/:storeId/traffic-analytics')
	@ApiOperation({
		summary: 'Get traffic analytics for landing pages',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Number of top landing pages to return (default: 10)',
	})
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Start date filter (YYYY-MM-DD)',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'End date filter (YYYY-MM-DD)',
	})
	@ApiResponse({
		status: 200,
		description: 'Traffic analytics retrieved successfully',
		schema: {
			type: 'object',
			properties: {
				storeId: { type: 'string' },
				storeName: { type: 'string' },
				topLandingPages: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							landingPageType: { type: 'string' },
							landingPagePath: { type: 'string' },
							onlineStoreVisitors: { type: 'number' },
							sessions: { type: 'number' },
							sessionsWithCartAdditions: { type: 'number' },
							sessionsThatReachedCheckout: { type: 'number' },
							conversionRate: { type: 'number' },
							lastSyncDate: { type: 'string' },
						},
					},
				},
			},
		},
	})
	@ApiResponse({ status: 404, description: 'Store not found' })
	async getTrafficAnalytics(
		@Param('storeId') storeId: string,
		@Query('limit') limit?: number,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
	) {
		const store = await this.storesService.findOne(storeId);
		const pageLimit = limit && limit > 0 ? limit : 10;

		const start = startDate ? new Date(startDate) : undefined;
		const end = endDate ? new Date(endDate) : undefined;

		const topLandingPages =
			await this.trafficMetricsService.getTopLandingPagesByStore(
				storeId,
				pageLimit,
				start,
				end,
			);

		return {
			storeId: store._id,
			storeName: store.name,
			topLandingPages: topLandingPages.map((p) => ({
				landingPageType: p.landingPageType,
				landingPagePath: p.landingPagePath,
				onlineStoreVisitors: p.onlineStoreVisitors,
				sessions: p.sessions,
				sessionsWithCartAdditions: p.sessionsWithCartAdditions,
				sessionsThatReachedCheckout: p.sessionsThatReachedCheckout,
				conversionRate:
					p.sessions > 0
						? Math.round(
								(p.sessionsThatReachedCheckout / p.sessions) *
									10000,
							) / 100
						: 0,
				lastSyncDate: p.lastSyncDate,
			})),
		};
	}

	@Post('stores/:storeId/sync-traffic')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({
		summary: 'Sync traffic analytics for a store (Admin/Manager only)',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'days',
		required: false,
		type: Number,
		description: 'Number of days to analyze (default: 7)',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Number of top landing pages to fetch (default: 10)',
	})
	@ApiResponse({
		status: 200,
		description: 'Traffic analytics sync completed successfully',
	})
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async syncTrafficAnalytics(
		@Param('storeId') storeId: string,
		@Query('days') days?: number,
		@Query('limit') limit?: number,
	) {
		const store = await this.storesService.findOne(storeId);

		const daysBack = days && days > 0 ? days : 7;
		const pageLimit = limit && limit > 0 ? limit : 10;

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - daysBack);
		startDate.setHours(0, 0, 0, 0);

		const endDate = new Date();
		endDate.setHours(23, 59, 59, 999);

		this.logger.log(
			`Starting traffic analytics sync for ${store.name} (last ${daysBack} days, top ${pageLimit} pages)`,
		);

		// Reset existing data for this date range
		await this.trafficMetricsService.resetStoreTraffic(storeId, startDate);

		const trafficData = await this.shopifyService.fetchTrafficAnalytics(
			store,
			daysBack,
			pageLimit,
		);

		let processedCount = 0;
		for (const page of trafficData) {
			await this.trafficMetricsService.upsertTrafficMetric({
				storeId: store._id,
				landingPageType: page.landingPageType,
				landingPagePath: page.landingPagePath,
				onlineStoreVisitors: page.onlineStoreVisitors,
				sessions: page.sessions,
				sessionsWithCartAdditions: page.sessionsWithCartAdditions,
				sessionsThatReachedCheckout: page.sessionsThatReachedCheckout,
				startDate,
				endDate,
			});
			processedCount++;
		}

		this.logger.log(`✓ Traffic analytics sync completed for ${store.name}`);
		this.logger.log(`Processed ${processedCount} landing pages`);

		return {
			message: `Traffic analytics synced for store: ${store.name}`,
			dateRange: `Last ${daysBack} days`,
			landingPagesProcessed: processedCount,
		};
	}

	@Get('stores/:storeId/geographical')
	@ApiOperation({
		summary: 'Get geographical analytics with sessions and sales data',
		description:
			'Fetch combined geographical data including sessions, checkouts, add to carts, revenue, and orders by country, region, and city',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'startDate',
		required: false,
		type: String,
		description: 'Start date in YYYY-MM-DD format (default: 30 days ago)',
		example: '2025-11-01',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		type: String,
		description: 'End date in YYYY-MM-DD format (default: today)',
		example: '2025-12-16',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Number of results to return (default: 100)',
	})
	@ApiQuery({
		name: 'groupBy',
		required: false,
		enum: ['country', 'region', 'city'],
		description: 'Grouping level (default: city)',
	})
	@ApiResponse({
		status: 200,
		description: 'Geographical analytics retrieved successfully',
		schema: {
			type: 'object',
			properties: {
				storeId: { type: 'string' },
				storeName: { type: 'string' },
				dateRange: {
					type: 'object',
					properties: {
						from: { type: 'string' },
						to: { type: 'string' },
					},
				},
				groupBy: { type: 'string' },
				data: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							country: { type: 'string' },
							region: { type: 'string', nullable: true },
							city: { type: 'string', nullable: true },
							sessions: { type: 'number' },
							sessionsCompletedCheckout: { type: 'number' },
							addToCarts: { type: 'number' },
							orders: { type: 'number' },
							revenue: { type: 'number' },
							conversionRate: { type: 'number' },
							averageOrderValue: { type: 'number' },
						},
					},
				},
				totalRecords: { type: 'number' },
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Invalid parameters' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async getGeographicalData(
		@Param('storeId') storeId: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('limit') limit?: number,
		@Query('groupBy') groupBy?: string,
	): Promise<any> {
		const resultLimit = limit && limit > 0 ? limit : 100;
		const groupingLevel = groupBy || 'city';

		// Calculate defaults if dates are missing
		const today = new Date();
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(today.getDate() - 30);

		const finalStartDate =
			startDate || thirtyDaysAgo.toISOString().split('T')[0];
		const finalEndDate = endDate || today.toISOString().split('T')[0];

		// Basic validation
		if (new Date(finalStartDate) > new Date(finalEndDate)) {
			throw new BadRequestException(
				'Start date cannot be after end date',
			);
		}

		const store = await this.storesService.findOne(storeId);

		this.logger.log(
			`Fetching geographical analytics for ${store.name}: ${finalStartDate} to ${finalEndDate}, grouped by ${groupingLevel}`,
		);

		const data = await this.geoMetricsService.fetchGeographicalData(
			store,
			finalStartDate,
			finalEndDate,
			resultLimit,
			groupingLevel as 'country' | 'region' | 'city',
		);

		return {
			storeId: store._id,
			storeName: store.name,
			dateRange: {
				from: finalStartDate,
				to: finalEndDate,
			},
			groupBy: groupingLevel,
			data,
			totalRecords: data.length,
		};
	}
}
