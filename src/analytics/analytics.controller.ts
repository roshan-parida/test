import {
	Controller,
	Get,
	Param,
	Post,
	UseGuards,
	Logger,
	Query,
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
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { StoresService } from '../stores/stores.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { ProductMetricsService } from '../analytics/analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
	private readonly logger = new Logger(AnalyticsController.name);

	constructor(
		private readonly storesService: StoresService,
		private readonly shopifyService: ShopifyService,
		private readonly productMetricsService: ProductMetricsService,
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
				quantitySold: product.quantitySold,
				revenue: product.revenue,
			});
			processedCount++;
		}

		this.logger.log(
			`✓ Product analytics sync completed for ${store.name}. Processed ${processedCount} products.`,
		);

		return {
			message: `Product analytics synced for store: ${store.name}`,
			dateRange: from
				? `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`
				: 'All-time data',
			productsProcessed: processedCount,
		};
	}
}
