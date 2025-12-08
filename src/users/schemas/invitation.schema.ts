import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Invitation extends Document {
	@Prop({ required: true })
	email: string;

	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	invitedBy: Types.ObjectId;

	@Prop({ type: [{ type: Types.ObjectId, ref: 'Store' }], required: true })
	assignedStores: Types.ObjectId[];

	@Prop({ required: true })
	storeName: string;

	@Prop({ required: true })
	storeUrl: string;

	@Prop({ required: true, unique: true })
	token: string;

	@Prop({ required: true })
	expiresAt: Date;

	@Prop({ default: false })
	isAccepted: boolean;

	createdAt: Date;
	updatedAt: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

InvitationSchema.index({ email: 1, isAccepted: 1 });
InvitationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL
