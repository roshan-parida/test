import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ProductMetric extends Document {
	@Prop({ type: Types.ObjectId, ref: 'Store', required: true })
	storeId: Types.ObjectId;

	@Prop({ required: true })
	productId: string; // Shopify product ID

	@Prop({ required: true })
	productName: string;

	@Prop({ required: true })
	productImage: string;

	@Prop({ default: 0 })
	totalQuantitySold: number;

	@Prop({ default: 0 })
	totalRevenue: number;

	@Prop({ type: Date, required: true })
	lastSyncDate: Date;

	createdAt: Date;
	updatedAt: Date;
}

export const ProductMetricSchema = SchemaFactory.createForClass(ProductMetric);

ProductMetricSchema.index({ storeId: 1, productId: 1 }, { unique: true });
ProductMetricSchema.index({ storeId: 1, totalQuantitySold: -1 });
