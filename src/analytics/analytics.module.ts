import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { ProductMetricsService } from '../analytics/analytics.service';
import {
	ProductMetric,
	ProductMetricSchema,
} from '../analytics/schemas/product-metric.schema';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { ShopifyService } from '../integrations/shopify/shopify.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: ProductMetric.name, schema: ProductMetricSchema },
		]),
		forwardRef(() => StoresModule),
		forwardRef(() => UsersModule),
	],
	providers: [ProductMetricsService, ShopifyService],
	controllers: [AnalyticsController],
	exports: [ProductMetricsService],
})
export class AnalyticsModule {}
