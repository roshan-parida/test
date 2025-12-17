import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';

@Schema({ timestamps: true })
export class User extends Document {
	@Prop({ required: true })
	name: string;

	@Prop({ required: true, unique: true })
	email: string;

	@Prop({ required: false })
	phone?: string;

	@Prop({ required: false })
	profileImage?: string;

	@Prop({ required: true })
	password: string;

	@Prop({ type: String, enum: UserRole, default: UserRole.VIEWER })
	role: UserRole;

	@Prop({ default: true })
	isActive: boolean;

	@Prop({ required: true })
	storeName: string;

	@Prop({ required: true })
	storeUrl: string;

	@Prop({ type: [{ type: Types.ObjectId, ref: 'Store' }], default: [] })
	assignedStores: Types.ObjectId[];

	createdAt: Date;
	updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
