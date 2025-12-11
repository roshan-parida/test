import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PasswordReset extends Document {
	@Prop({ required: true })
	email: string;

	@Prop({ required: true })
	otp: string;

	@Prop({ required: true })
	otpExpiresAt: Date;

	@Prop({ default: false })
	isUsed: boolean;

	createdAt: Date;
	updatedAt: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

// TTL index to auto-delete after 1 hour
PasswordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });
PasswordResetSchema.index({ email: 1, isUsed: 1 });
