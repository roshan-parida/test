import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StoreStatus } from 'src/common/enums/store-status.enum';

@Schema({ timestamps: true })
export class Store extends Document {
	@Prop({ required: true, unique: true })
	name: string;

	@Prop({ required: false })
	storeLogo?: string;

	// Shopify OAuth
	@Prop({ required: false })
	shopifyToken: string;

	@Prop({ required: true })
	shopifyStoreUrl: string;

	@Prop({ required: false })
	shopifyTokenExpiresAt?: Date;

	// Facebook/Meta OAuth
	@Prop({ required: false })
	fbAdSpendToken: string;

	@Prop({ required: false })
	fbAccountId: string;

	@Prop({ required: false })
	fbRefreshToken?: string;

	@Prop({ required: false })
	fbTokenExpiresAt?: Date;

	// Google Ads OAuth
	@Prop({ required: false })
	googleAccessToken?: string;

	@Prop({ required: false })
	googleRefreshToken?: string;

	@Prop({ required: false })
	googleTokenExpiresAt?: Date;

	@Prop({ required: false })
	googleCustomerId?: string; // Format: "123-456-7890" or "1234567890"

	// Store approval
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
