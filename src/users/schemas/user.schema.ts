import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';

@Schema({ timestamps: true })
export class User extends Document {
	@Prop({ required: true, unique: true })
	email: string;

	@Prop({ required: true })
	password: string;

	@Prop({ type: String, enum: UserRole, default: UserRole.VIEWER })
	role: UserRole;

	@Prop({ default: true })
	isActive: boolean;

	// NEW: Store access control
	@Prop({ type: [{ type: Types.ObjectId, ref: 'Store' }], default: [] })
	assignedStores: Types.ObjectId[];

	createdAt: Date;
	updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
