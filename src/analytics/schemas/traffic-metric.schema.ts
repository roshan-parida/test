import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TrafficMetric extends Document {
	@Prop({ type: Types.ObjectId, ref: 'Store', required: true })
	storeId: Types.ObjectId;

	@Prop({ required: true })
	landingPageType: string;

	@Prop({ required: true })
	landingPagePath: string;

	@Prop({ default: 0 })
	onlineStoreVisitors: number;

	@Prop({ default: 0 })
	sessions: number;

	@Prop({ default: 0 })
	sessionsWithCartAdditions: number;

	@Prop({ default: 0 })
	sessionsThatReachedCheckout: number;

	@Prop({ type: Date, required: true })
	startDate: Date;

	@Prop({ type: Date, required: true })
	endDate: Date;

	@Prop({ type: Date, required: true })
	lastSyncDate: Date;

	createdAt: Date;
	updatedAt: Date;
}

export const TrafficMetricSchema = SchemaFactory.createForClass(TrafficMetric);

TrafficMetricSchema.index(
	{ storeId: 1, landingPagePath: 1, startDate: 1 },
	{ unique: true },
);
TrafficMetricSchema.index({ storeId: 1, sessions: -1 });
