import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Otp extends Document {
	@Prop({ required: true })
	email: string;

	@Prop({ required: true })
	otp: string;

	@Prop({ required: true })
	expiresAt: Date;

	@Prop({ default: false })
	isVerified: boolean;

	createdAt: Date;
	updatedAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// TTL index to auto-delete expired OTPs
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpSchema.index({ email: 1, isVerified: 1 });
