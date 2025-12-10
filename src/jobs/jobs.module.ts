import { Module, forwardRef } from '@nestjs/common';
import { SyncMetricsJob } from './sync-metrics.job';
import { SyncProductMetricsJob } from './sync-product-metrics.job';
import { SyncTrafficMetricsJob } from './sync-traffic-metrics.job';
import { StoresModule } from '../stores/stores.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { FacebookService } from '../integrations/facebook/facebook.service';
import { GoogleService } from '../integrations/google/google.service';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [
		forwardRef(() => StoresModule),
		forwardRef(() => MetricsModule),
		forwardRef(() => AnalyticsModule),
		AuditModule,
	],
	providers: [
		SyncMetricsJob,
		SyncProductMetricsJob,
		SyncTrafficMetricsJob,
		ShopifyService,
		FacebookService,
		GoogleService,
	],
})
export class JobsModule {}
