import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoresService } from '../stores/stores.service';
import { MetricsService } from '../metrics/metrics.service';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { FacebookService } from '../integrations/facebook/facebook.service';
import { GoogleService } from '../integrations/google/google.service';

@Injectable()
export class SyncMetricsJob {
	private readonly logger = new Logger(SyncMetricsJob.name);

	constructor(
		private readonly storesService: StoresService,
		private readonly metricsService: MetricsService,
		private readonly shopifyService: ShopifyService,
		private readonly facebookService: FacebookService,
		private readonly googleService: GoogleService,
	) {}

	private getYesterdayInIST(): Date {
		// Get current time in IST
		const now = new Date();
		const istDateString = now.toLocaleString('en-US', {
			timeZone: 'Asia/Kolkata',
		});
		const istNow = new Date(istDateString);

		// Get yesterday in IST
		const yesterdayIST = new Date(istNow);
		yesterdayIST.setDate(yesterdayIST.getDate() - 1);
		yesterdayIST.setHours(0, 0, 0, 0);

		this.logger.log(`Current IST time: ${istDateString}`);
		this.logger.log(`Yesterday IST (start): ${yesterdayIST.toISOString()}`);

		return yesterdayIST;
	}

	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	async handleDailySync() {
		this.logger.log('Starting daily metrics sync...');

		const stores = await this.storesService.findAll();

		// Get yesterday in IST timezone
		const yesterday = this.getYesterdayInIST();
		const yesterdayEnd = new Date(yesterday);
		yesterdayEnd.setHours(23, 59, 59, 999);

		this.logger.log(
			`Syncing data for date: ${yesterday.toISOString().slice(0, 10)} (IST)`,
		);

		for (const store of stores) {
			try {
				this.logger.debug(`Processing store: ${store.name}`);

				const [shopifyData, fbData, googleSpend] = await Promise.all([
					this.shopifyService.fetchOrders(
						store,
						yesterday,
						yesterdayEnd,
					),
					this.facebookService.fetchAdSpend(
						store,
						yesterday,
						yesterdayEnd,
					),
					this.googleService.fetchAdSpend(
						store,
						yesterday,
						yesterdayEnd,
					),
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

				let savedCount = 0;
				for (const metric of metricsByDate.values()) {
					await this.metricsService.createOrUpdate(metric);
					savedCount++;
				}

				this.logger.log(
					`✓ Synced ${savedCount} days for ${store.name}`,
				);
			} catch (error) {
				this.logger.error(
					`✗ Failed to sync ${store.name}: ${(error as any).message}`,
					(error as any).stack,
				);
			}
		}

		this.logger.log('Daily metrics sync completed');
	}
}
