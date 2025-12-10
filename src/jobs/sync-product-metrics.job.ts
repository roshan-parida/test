import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoresService } from '../stores/stores.service';
import { ProductMetricsService } from '../analytics/product-metric.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';

@Injectable()
export class SyncProductMetricsJob {
	private readonly logger = new Logger(SyncProductMetricsJob.name);

	constructor(
		private readonly storesService: StoresService,
		private readonly productMetricsService: ProductMetricsService,
		private readonly shopifyService: ShopifyService,
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	async handleDailyProductSync() {
		this.logger.log('Starting daily product metrics sync...');

		const stores = await this.storesService.findAll();

		for (const store of stores) {
			try {
				const now = new Date();
				const to = new Date(
					now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
				);
				to.setHours(23, 59, 59, 999);

				const from = new Date(to);
				from.setDate(from.getDate() - 30);
				from.setHours(0, 0, 0, 0);

				this.logger.log(
					`Syncing products for ${store.name}: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
				);

				// Reset existing data before fresh sync
				await this.productMetricsService.resetStoreProducts(
					store._id.toString(),
				);

				// Fetch product sales data
				const productSales =
					await this.shopifyService.fetchProductSales(
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

				this.logger.log(
					`✓ Synced ${processedCount} products for ${store.name} (last 30 days)`,
				);
			} catch (error) {
				this.logger.error(
					`✗ Failed to sync products for ${store.name}: ${(error as any).message}`,
					(error as any).stack,
				);
			}
		}

		this.logger.log('Daily product metrics sync completed');
	}

	@Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
	async handleMonthlyFullSync() {
		this.logger.log(
			'Starting monthly full product metrics sync (all-time)...',
		);

		const stores = await this.storesService.findAll();

		for (const store of stores) {
			try {
				this.logger.debug(
					`Processing all-time product metrics for: ${store.name}`,
				);

				// Reset existing data before fresh sync
				await this.productMetricsService.resetStoreProducts(
					store._id.toString(),
				);

				// Fetch all-time product sales data (no date range)
				const productSales =
					await this.shopifyService.fetchProductSales(store);

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

				this.logger.log(
					`✓ Synced ${processedCount} products for ${store.name} (all-time)`,
				);
			} catch (error) {
				this.logger.error(
					`✗ Failed to sync all-time products for ${store.name}: ${(error as any).message}`,
					(error as any).stack,
				);
			}
		}

		this.logger.log('Monthly full product metrics sync completed');
	}
}
