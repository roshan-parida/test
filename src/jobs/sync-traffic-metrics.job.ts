import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoresService } from '../stores/stores.service';
import { TrafficMetricsService } from '../analytics/traffic-metric.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';

@Injectable()
export class SyncTrafficMetricsJob {
	private readonly logger = new Logger(SyncTrafficMetricsJob.name);

	constructor(
		private readonly storesService: StoresService,
		private readonly trafficMetricsService: TrafficMetricsService,
		private readonly shopifyService: ShopifyService,
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_4AM)
	async handleDailyTrafficSync() {
		this.logger.log('Starting daily traffic metrics sync...');

		const stores = await this.storesService.findAll();
		const daysBack = 7; // Last 7 days
		const pageLimit = 20; // Top 20 landing pages

		for (const store of stores) {
			try {
				const now = new Date();
				const endDate = new Date(
					now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
				);
				endDate.setHours(23, 59, 59, 999);

				const startDate = new Date(endDate);
				startDate.setDate(startDate.getDate() - daysBack);
				startDate.setHours(0, 0, 0, 0);

				this.logger.log(
					`Processing traffic metrics for: ${store.name} from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
				);

				// Reset existing data for this date range
				await this.trafficMetricsService.resetStoreTraffic(
					store._id.toString(),
					startDate,
				);

				// Fetch traffic analytics
				const trafficData =
					await this.shopifyService.fetchTrafficAnalytics(
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
						sessionsWithCartAdditions:
							page.sessionsWithCartAdditions,
						sessionsThatReachedCheckout:
							page.sessionsThatReachedCheckout,
						startDate,
						endDate,
					});
					processedCount++;
				}

				this.logger.log(
					`✓ Synced ${processedCount} landing pages for ${store.name} (last ${daysBack} days)`,
				);
			} catch (error) {
				this.logger.error(
					`✗ Failed to sync traffic for ${store.name}: ${(error as any).message}`,
					(error as any).stack,
				);
			}
		}

		this.logger.log('Daily traffic metrics sync completed');
	}

	@Cron(CronExpression.EVERY_WEEK)
	async handleWeeklyExtendedSync() {
		this.logger.log('Starting weekly extended traffic metrics sync...');

		const stores = await this.storesService.findAll();
		const daysBack = 30; // Last 30 days
		const pageLimit = 50; // Top 50 landing pages

		for (const store of stores) {
			try {
				const now = new Date();
				const endDate = new Date(
					now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
				);
				endDate.setHours(23, 59, 59, 999);

				const startDate = new Date(endDate);
				startDate.setDate(startDate.getDate() - daysBack);
				startDate.setHours(0, 0, 0, 0);

				this.logger.log(
					`Processing extended traffic metrics for: ${store.name} from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`,
				);

				// Reset existing data for this date range
				await this.trafficMetricsService.resetStoreTraffic(
					store._id.toString(),
					startDate,
				);

				// Fetch traffic analytics
				const trafficData =
					await this.shopifyService.fetchTrafficAnalytics(
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
						sessionsWithCartAdditions:
							page.sessionsWithCartAdditions,
						sessionsThatReachedCheckout:
							page.sessionsThatReachedCheckout,
						startDate,
						endDate,
					});
					processedCount++;
				}

				this.logger.log(
					`✓ Synced ${processedCount} landing pages for ${store.name} (last ${daysBack} days)`,
				);
			} catch (error) {
				this.logger.error(
					`✗ Failed to sync extended traffic for ${store.name}: ${(error as any).message}`,
					(error as any).stack,
				);
			}
		}

		this.logger.log('Weekly extended traffic metrics sync completed');
	}
}
