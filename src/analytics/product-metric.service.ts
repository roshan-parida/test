import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductMetric } from './schemas/product-metric.schema';

export interface ProductSalesInput {
	storeId: Types.ObjectId | string;
	productId: string;
	productName: string;
	productImage: string;
	productUrl: string;
	quantitySold: number;
	revenue: number;
}

@Injectable()
export class ProductMetricsService {
	constructor(
		@InjectModel(ProductMetric.name)
		private readonly productMetricModel: Model<ProductMetric>,
	) {}

	async upsertProductMetric(
		input: ProductSalesInput,
	): Promise<ProductMetric> {
		return this.productMetricModel
			.findOneAndUpdate(
				{
					storeId: new Types.ObjectId(input.storeId),
					productId: input.productId,
				},
				{
					$set: {
						productName: input.productName,
						productImage: input.productImage,
						productUrl: input.productUrl,
						lastSyncDate: new Date(),
					},
					$inc: {
						totalQuantitySold: input.quantitySold,
						totalRevenue: input.revenue,
					},
				},
				{ new: true, upsert: true },
			)
			.exec();
	}

	async getTopProductsByStore(
		storeId: string,
		limit: number = 5,
	): Promise<ProductMetric[]> {
		return this.productMetricModel
			.find({ storeId: new Types.ObjectId(storeId) })
			.sort({ totalRevenue: -1, totalQuantitySold: -1 })
			.limit(limit)
			.exec();
	}

	async resetStoreProducts(storeId: string): Promise<void> {
		await this.productMetricModel
			.updateMany(
				{ storeId: new Types.ObjectId(storeId) },
				{
					$set: {
						totalQuantitySold: 0,
						totalRevenue: 0,
					},
				},
			)
			.exec();
	}

	async deleteByStoreId(storeId: string): Promise<void> {
		await this.productMetricModel
			.deleteMany({ storeId: new Types.ObjectId(storeId) })
			.exec();
	}
}
