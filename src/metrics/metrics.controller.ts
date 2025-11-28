import { Controller, Get, Query, Param, Post, UseGuards } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
	ApiQuery,
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

@ApiTags('Metrics')
@ApiBearerAuth('JWT-auth')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MetricsController {
	constructor(
		private readonly metricsService: MetricsService,
		private readonly storesService: StoresService,
		private readonly shopifyService: ShopifyService,
		private readonly facebookService: FacebookService,
		private readonly googleService: GoogleService,
	) {}

	@Get('stores/:storeId/metrics')
	@ApiOperation({ summary: 'Get metrics for a specific store' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'range',
		required: false,
		enum: ['last7days', 'last30days'],
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
	@ApiOperation({ summary: 'Get aggregated metrics across all stores' })
	@ApiQuery({
		name: 'range',
		required: false,
		enum: ['last7days', 'last30days'],
		description: 'Date range for aggregation',
	})
	@ApiResponse({
		status: 200,
		description: 'Aggregated metrics retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getAggregate(@Query('range') range?: string) {
		return this.metricsService.aggregate(range || 'last30days');
	}

	@Post('metrics/sync/:storeId')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({
		summary:
			'Manually trigger metrics sync for a store (Admin/Manager only)',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 200, description: 'Sync initiated successfully' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async manualSync(@Param('storeId') storeId: string) {
		const store = await this.storesService.findOne(storeId);

		const date = new Date();
		date.setDate(date.getDate() - 1);
		date.setHours(0, 0, 0, 0);

		const shopifyData = await this.shopifyService.fetchOrders(
			store,
			date,
			date,
		);
		const fbSpend = await this.facebookService.fetchAdSpend(
			store,
			date,
			date,
		);
		const googleSpend = await this.googleService.fetchAdSpend(
			store,
			date,
			date,
		);

		await this.metricsService.createOrUpdate({
			storeId: store._id,
			date,
			facebookMetaSpend: fbSpend,
			googleAdSpend: googleSpend,
			shopifySoldOrders: shopifyData.soldOrders,
			shopifyOrderValue: shopifyData.orderValue,
			shopifySoldItems: shopifyData.soldItems,
		});

		return {
			message: `Sync initiated for store: ${store.name}`,
			jobId: `manual-${Date.now()}`,
		};
	}
}
