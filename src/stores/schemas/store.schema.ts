import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StoreStatus } from 'src/common/enums/store-status.enum';

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

	// Oauth start
	@Prop({ required: false })
	shopifyTokenExpiresAt?: Date;

	@Prop({ required: false })
	fbRefreshToken?: string;

	@Prop({ required: false })
	fbTokenExpiresAt?: Date;

	@Prop({ required: false })
	googleRefreshToken?: string;

	@Prop({ required: false })
	googleTokenExpiresAt?: Date;

	@Prop({ required: false })
	googleCustomerId?: string;
	// Oauth end

	@Prop({ type: String, enum: StoreStatus, default: StoreStatus.PENDING })
	status: StoreStatus;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	createdBy: Types.ObjectId;

	@Prop({ type: String })
	rejectionReason?: string;

	createdAt: Date;
	updatedAt: Date;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
