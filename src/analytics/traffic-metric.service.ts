import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TrafficMetric } from './schemas/traffic-metric.schema';

export interface TrafficDataInput {
	storeId: Types.ObjectId | string;
	landingPageType: string;
	landingPagePath: string;
	onlineStoreVisitors: number;
	sessions: number;
	sessionsWithCartAdditions: number;
	sessionsThatReachedCheckout: number;
	startDate: Date;
	endDate: Date;
}

@Injectable()
export class TrafficMetricsService {
	constructor(
		@InjectModel(TrafficMetric.name)
		private readonly trafficMetricModel: Model<TrafficMetric>,
	) {}

	async upsertTrafficMetric(input: TrafficDataInput): Promise<TrafficMetric> {
		return this.trafficMetricModel
			.findOneAndUpdate(
				{
					storeId: new Types.ObjectId(input.storeId),
					landingPagePath: input.landingPagePath,
					startDate: input.startDate,
				},
				{
					$set: {
						landingPageType: input.landingPageType,
						onlineStoreVisitors: input.onlineStoreVisitors,
						sessions: input.sessions,
						sessionsWithCartAdditions:
							input.sessionsWithCartAdditions,
						sessionsThatReachedCheckout:
							input.sessionsThatReachedCheckout,
						endDate: input.endDate,
						lastSyncDate: new Date(),
					},
				},
				{ new: true, upsert: true },
			)
			.exec();
	}

	async getTopLandingPagesByStore(
		storeId: string,
		limit: number = 10,
		startDate?: Date,
		endDate?: Date,
	): Promise<TrafficMetric[]> {
		const filter: any = { storeId: new Types.ObjectId(storeId) };

		if (startDate || endDate) {
			filter.startDate = {};
			if (startDate) filter.startDate.$gte = startDate;
			if (endDate) filter.startDate.$lte = endDate;
		}

		return this.trafficMetricModel
			.find(filter)
			.sort({ sessions: -1 })
			.limit(limit)
			.exec();
	}

	async resetStoreTraffic(storeId: string, startDate: Date): Promise<void> {
		await this.trafficMetricModel
			.deleteMany({
				storeId: new Types.ObjectId(storeId),
				startDate: { $gte: startDate },
			})
			.exec();
	}

	async deleteByStoreId(storeId: string): Promise<void> {
		await this.trafficMetricModel
			.deleteMany({ storeId: new Types.ObjectId(storeId) })
			.exec();
	}
}
