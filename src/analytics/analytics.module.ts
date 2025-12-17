import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { ProductMetricsService } from './product-metric.service';
import { TrafficMetricsService } from './traffic-metric.service';
import {
	ProductMetric,
	ProductMetricSchema,
} from './schemas/product-metric.schema';
import {
	TrafficMetric,
	TrafficMetricSchema,
} from './schemas/traffic-metric.schema';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { AuditModule } from 'src/audit/audit.module';
import { GeoMetricsService } from './geo-metric.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: ProductMetric.name, schema: ProductMetricSchema },
			{ name: TrafficMetric.name, schema: TrafficMetricSchema },
		]),
		forwardRef(() => StoresModule),
		forwardRef(() => UsersModule),
		AuditModule,
	],
	providers: [
		ProductMetricsService,
		TrafficMetricsService,
		GeoMetricsService,
		ShopifyService,
	],
	controllers: [AnalyticsController],
	exports: [ProductMetricsService, TrafficMetricsService, GeoMetricsService],
})
export class AnalyticsModule {}
