import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PendingUser extends Document {
	@Prop({ required: true, unique: true })
	email: string;

	@Prop({ required: true })
	name: string;

	@Prop({ required: true })
	password: string;

	@Prop({ required: false })
	phone?: string;

	@Prop({ required: true })
	storeName: string;

	@Prop({ required: false })
	profileImage?: string;

	@Prop({ required: true })
	storeUrl: string;

	@Prop({ required: false })
	storeLogo?: string;

	@Prop({ required: true })
	otp: string;

	@Prop({ required: true })
	otpExpiresAt: Date;

	@Prop({ default: false })
	isVerified: boolean;

	createdAt: Date;
	updatedAt: Date;
}

export const PendingUserSchema = SchemaFactory.createForClass(PendingUser);

// TTL index to auto-delete after 24 hours if not verified
PendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
PendingUserSchema.index({ email: 1, isVerified: 1 });
