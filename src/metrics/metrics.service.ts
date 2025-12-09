import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StoreMetric } from './schemas/store-metric.schema';

export interface CreateMetricInput {
	storeId: Types.ObjectId | string;
	date: Date;
	facebookMetaSpend: number;
	googleAdSpend: number;
	shopifySoldOrders: number;
	shopifyOrderValue: number;
	shopifySoldItems: number;
}

@Injectable()
export class MetricsService {
	constructor(
		@InjectModel(StoreMetric.name)
		private readonly metricModel: Model<StoreMetric>,
	) {}

	async create(input: CreateMetricInput): Promise<StoreMetric> {
		const metric = new this.metricModel({
			...input,
			storeId: new Types.ObjectId(input.storeId),
		});
		return metric.save();
	}

	async createOrUpdate(input: CreateMetricInput): Promise<StoreMetric> {
		return this.metricModel
			.findOneAndUpdate(
				{
					storeId: new Types.ObjectId(input.storeId),
					date: input.date,
				},
				{
					$set: {
						facebookMetaSpend: input.facebookMetaSpend,
						googleAdSpend: input.googleAdSpend,
						shopifySoldOrders: input.shopifySoldOrders,
						shopifyOrderValue: input.shopifyOrderValue,
						shopifySoldItems: input.shopifySoldItems,
					},
				},
				{ new: true, upsert: true },
			)
			.exec();
	}

	private buildDateRangeFilter(
		range?: string,
		startDate?: string,
		endDate?: string,
	) {
		const filter: any = {};
		if (startDate || endDate) {
			filter.date = {};
			if (startDate) filter.date.$gte = new Date(startDate);
			if (endDate) filter.date.$lte = new Date(endDate);
			return filter;
		}

		if (range) {
			const daysMap: { [key: string]: number } = {
				last7days: 7,
				last14days: 14,
				last30days: 30,
				last60days: 60,
				last90days: 90,
			};
			const days = daysMap[range];
			if (days) {
				const from = new Date();
				from.setDate(from.getDate() - days);
				from.setHours(0, 0, 0, 0);
				filter.date = { $gte: from };
			}
		}

		return filter;
	}

	async findByStore(
		storeId: string,
		range?: string,
		startDate?: string,
		endDate?: string,
	): Promise<StoreMetric[]> {
		const filter = this.buildDateRangeFilter(range, startDate, endDate);
		filter.storeId = new Types.ObjectId(storeId);

		return this.metricModel.find(filter).sort({ date: 1 }).exec();
	}

	async aggregate(
		range?: string,
		storeIds?: string[],
	): Promise<{
		totalStores: number;
		totalAdSpend: number;
		totalOrders: number;
		totalRevenue: number;
		dateRange: string;
	}> {
		const filter = this.buildDateRangeFilter(range);

		if (storeIds && storeIds.length > 0) {
			filter.storeId = {
				$in: storeIds.map((id) => new Types.ObjectId(id)),
			};
		}

		const pipeline: any[] = [
			{ $match: filter },
			{
				$group: {
					_id: '$storeId',
					facebookMetaSpend: { $sum: '$facebookMetaSpend' },
					googleAdSpend: { $sum: '$googleAdSpend' },
					shopifySoldOrders: { $sum: '$shopifySoldOrders' },
					shopifyOrderValue: { $sum: '$shopifyOrderValue' },
				},
			},
		];

		const result = await this.metricModel.aggregate(pipeline).exec();

		const totalStores = result.length;
		const totalAdSpend = result.reduce(
			(sum, r) =>
				sum + (r.facebookMetaSpend || 0) + (r.googleAdSpend || 0),
			0,
		);
		const totalOrders = result.reduce(
			(sum, r) => sum + (r.shopifySoldOrders || 0),
			0,
		);
		const totalRevenue = result.reduce(
			(sum, r) => sum + (r.shopifyOrderValue || 0),
			0,
		);

		return {
			totalStores,
			totalAdSpend,
			totalOrders,
			totalRevenue,
			dateRange: range || 'last30days',
		};
	}

	async deleteByStoreId(storeId: string): Promise<void> {
		await this.metricModel
			.deleteMany({ storeId: new Types.ObjectId(storeId) })
			.exec();
	}
}
