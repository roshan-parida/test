import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Store extends Document {
	@Prop({ required: true, unique: true })
	name: string;

	@Prop({ required: false })
	storeLogo?: string;

	@Prop({ required: true })
	shopifyToken: string;

	@Prop({ required: true })
	shopifyStoreUrl: string;

	@Prop({ required: true })
	fbAdSpendToken: string;

	@Prop({ required: true })
	fbAccountId: string;

	createdAt: Date;
	updatedAt: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
