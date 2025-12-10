import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { StoreMetric, StoreMetricSchema } from './schemas/store-metric.schema';
import { StoresModule } from '../stores/stores.module';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { FacebookService } from '../integrations/facebook/facebook.service';
import { GoogleService } from '../integrations/google/google.service';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: StoreMetric.name, schema: StoreMetricSchema },
		]),
		forwardRef(() => StoresModule),
		AuditModule,
	],
	providers: [MetricsService, ShopifyService, FacebookService, GoogleService],
	controllers: [MetricsController],
	exports: [MetricsService],
})
export class MetricsModule {}
