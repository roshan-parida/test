import {
	Controller,
	Get,
	Query,
	Param,
	Post,
	UseGuards,
	Logger,
	Body,
	Request,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
	ApiQuery,
	ApiBody,
} from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { StoresService } from '../stores/stores.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { FacebookService } from '../integrations/facebook/facebook.service';
import { GoogleService } from '../integrations/google/google.service';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';

@ApiTags('Metrics')
@ApiBearerAuth('JWT-auth')
@Controller()
export class MetricsController {
	private readonly logger = new Logger(MetricsController.name);

	constructor(
		private readonly metricsService: MetricsService,
		private readonly storesService: StoresService,
		private readonly shopifyService: ShopifyService,
		private readonly facebookService: FacebookService,
		private readonly googleService: GoogleService,
	) {}

	@Get('stores/:storeId/metrics')
	@UseGuards(JwtAuthGuard, RolesGuard, StoreAccessGuard)
	@ApiOperation({ summary: 'Get metrics for a specific store' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'range',
		required: false,
		enum: [
			'last7days',
			'last14days',
			'last30days',
			'last60days',
			'last90days',
		],
		description: 'Predefined date range',
	})
	@ApiQuery({
		name: 'startDate',
		required: false,
		description: 'Custom start date (YYYY-MM-DD)',
	})
	@ApiQuery({
		name: 'endDate',
		required: false,
		description: 'Custom end date (YYYY-MM-DD)',
	})
	@ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getStoreMetrics(
		@Param('storeId') storeId: string,
		@Query('range') range?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
	) {
		return this.metricsService.findByStore(
			storeId,
			range,
			startDate,
			endDate,
		);
	}

	@Get('metrics/aggregate')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@ApiOperation({ summary: 'Get aggregated metrics across assigned stores' })
	@ApiQuery({
		name: 'range',
		required: false,
		enum: [
			'last7days',
			'last14days',
			'last30days',
			'last60days',
			'last90days',
		],
		description: 'Date range for aggregation',
	})
	@ApiResponse({
		status: 200,
		description: 'Aggregated metrics retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getAggregate(@Request() req: any, @Query('range') range?: string) {
		const user = req.user;
		const isAdmin = user.role === UserRole.ADMIN;

		const storeIds = isAdmin
			? undefined
			: user.assignedStores && user.assignedStores.length > 0
				? user.assignedStores
				: null;

		if (storeIds === null) {
			return {
				totalStores: 0,
				totalAdSpend: 0,
				totalOrders: 0,
				totalRevenue: 0,
				dateRange: range || 'last30days',
			};
		}

		return this.metricsService.aggregate(range || 'last30days', storeIds);
	}

	@Post('metrics/sync/:storeId/daily')
	@UseGuards(JwtAuthGuard, RolesGuard, StoreAccessGuard)
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({
		summary:
			"Sync yesterday's metrics for a single store (Admin/Manager only)",
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({
		status: 200,
		description: 'Daily sync completed successfully',
	})
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async dailySync(@Param('storeId') storeId: string) {
		const store = await this.storesService.findOne(storeId);

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		yesterday.setHours(0, 0, 0, 0);

		this.logger.log(`Starting daily sync for store: ${store.name}`);

		const [shopifyData, fbData, googleSpend] = await Promise.all([
			this.shopifyService.fetchOrders(store, yesterday, yesterday),
			this.facebookService.fetchAdSpend(store, yesterday, yesterday),
			this.googleService.fetchAdSpend(store, yesterday, yesterday),
		]);

		const metricsByDate = new Map<string, any>();

		const getOrCreateEntry = (dateStr: string) => {
			if (!metricsByDate.has(dateStr)) {
				metricsByDate.set(dateStr, {
					storeId: store._id,
					date: new Date(dateStr),
					facebookMetaSpend: 0,
					googleAdSpend: 0,
					shopifySoldOrders: 0,
					shopifyOrderValue: 0,
					shopifySoldItems: 0,
				});
			}
			return metricsByDate.get(dateStr);
		};

		// Process Shopify
		if (Array.isArray(shopifyData)) {
			shopifyData.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.shopifySoldOrders = row.soldOrders;
				entry.shopifyOrderValue = row.orderValue;
				entry.shopifySoldItems = row.soldItems;
			});
		}

		// Process Facebook
		if (Array.isArray(fbData)) {
			fbData.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.facebookMetaSpend = row.spend;
			});
		}

		// Process Google
		if (Array.isArray(googleSpend)) {
			googleSpend.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.googleAdSpend = row.spend;
			});
		} else if (typeof googleSpend === 'number') {
			const dateStr = yesterday.toISOString().slice(0, 10);
			const entry = getOrCreateEntry(dateStr);
			entry.googleAdSpend = googleSpend;
		}

		let processedCount = 0;
		for (const metric of metricsByDate.values()) {
			await this.metricsService.createOrUpdate(metric);
			processedCount++;
		}

		this.logger.log(
			`Daily sync completed. Updated ${processedCount} day(s).`,
		);

		return {
			message: `Daily sync completed for store: ${store.name}`,
			date: yesterday.toISOString().slice(0, 10),
			daysProcessed: processedCount,
		};
	}

	@Post('metrics/sync/:storeId/range')
	@UseGuards(JwtAuthGuard, RolesGuard, StoreAccessGuard)
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: 'Backfill historical metrics for a date range (Admin only)',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				startDate: { type: 'string', example: '2024-11-01' },
				endDate: { type: 'string', example: '2025-11-30' },
			},
			required: ['startDate', 'endDate'],
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Range sync completed successfully',
	})
	@ApiResponse({ status: 400, description: 'Invalid date range' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async rangeSync(
		@Param('storeId') storeId: string,
		@Body('startDate') startDate: string,
		@Body('endDate') endDate: string,
	) {
		const store = await this.storesService.findOne(storeId);

		const from = new Date(startDate);
		const to = new Date(endDate);

		// Validation
		if (isNaN(from.getTime()) || isNaN(to.getTime())) {
			return {
				error: 'Invalid date format. Use YYYY-MM-DD',
				status: 400,
			};
		}

		if (from > to) {
			return {
				error: 'startDate must be before endDate',
				status: 400,
			};
		}

		const daysDiff = Math.ceil(
			(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
		);

		this.logger.warn(
			`⚠️  RANGE SYNC INITIATED for ${store.name}: ${startDate} to ${endDate} (${daysDiff} days)`,
		);

		const [shopifyData, fbData, googleSpend] = await Promise.all([
			this.shopifyService.fetchOrders(store, from, to),
			this.facebookService.fetchAdSpend(store, from, to),
			this.googleService.fetchAdSpend(store, from, to),
		]);

		const metricsByDate = new Map<string, any>();

		const getOrCreateEntry = (dateStr: string) => {
			if (!metricsByDate.has(dateStr)) {
				metricsByDate.set(dateStr, {
					storeId: store._id,
					date: new Date(dateStr),
					facebookMetaSpend: 0,
					googleAdSpend: 0,
					shopifySoldOrders: 0,
					shopifyOrderValue: 0,
					shopifySoldItems: 0,
				});
			}
			return metricsByDate.get(dateStr);
		};

		// Process Shopify
		if (Array.isArray(shopifyData)) {
			shopifyData.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.shopifySoldOrders = row.soldOrders;
				entry.shopifyOrderValue = row.orderValue;
				entry.shopifySoldItems = row.soldItems;
			});
		}

		// Process Facebook
		if (Array.isArray(fbData)) {
			fbData.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.facebookMetaSpend = row.spend;
			});
		}

		// Process Google
		if (Array.isArray(googleSpend)) {
			googleSpend.forEach((row) => {
				const entry = getOrCreateEntry(row.date);
				entry.googleAdSpend = row.spend;
			});
		}

		let processedCount = 0;
		for (const metric of metricsByDate.values()) {
			await this.metricsService.createOrUpdate(metric);
			processedCount++;
		}

		this.logger.log(
			`✓ Range sync completed. Updated ${processedCount} days for ${store.name}`,
		);

		return {
			message: `Range sync completed for store: ${store.name}`,
			startDate,
			endDate,
			daysProcessed: processedCount,
			jobId: `range-${Date.now()}`,
		};
	}
}
