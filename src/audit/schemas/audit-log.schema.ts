import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AuditAction {
	// Auth & User Actions
	USER_SIGNUP = 'USER_SIGNUP',
	USER_LOGIN = 'USER_LOGIN',
	USER_CREATED = 'USER_CREATED',
	USER_ROLE_UPDATED = 'USER_ROLE_UPDATED',
	USER_DEACTIVATED = 'USER_DEACTIVATED',
	USER_ACTIVATED = 'USER_ACTIVATED',
	INVITATION_SENT = 'INVITATION_SENT',
	INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
	STORES_ASSIGNED = 'STORES_ASSIGNED',
	STORES_REMOVED = 'STORES_REMOVED',

	// Shopify Actions
	SHOPIFY_SYNC_STARTED = 'SHOPIFY_SYNC_STARTED',
	SHOPIFY_SYNC_FAILED = 'SHOPIFY_SYNC_FAILED',
	SHOPIFY_ORDERS_FETCHED = 'SHOPIFY_ORDERS_FETCHED',
	SHOPIFY_PRODUCTS_SYNCED = 'SHOPIFY_PRODUCTS_SYNCED',
	SHOPIFY_TRAFFIC_SYNCED = 'SHOPIFY_TRAFFIC_SYNCED',

	// Facebook Actions
	FACEBOOK_SYNC_STARTED = 'FACEBOOK_SYNC_STARTED',
	FACEBOOK_SYNC_FAILED = 'FACEBOOK_SYNC_FAILED',
	FACEBOOK_AD_SPEND_FETCHED = 'FACEBOOK_AD_SPEND_FETCHED',
	FACEBOOK_INSIGHTS_FETCHED = 'FACEBOOK_INSIGHTS_FETCHED',
	FACEBOOK_API_ERROR = 'FACEBOOK_API_ERROR',

	// Store Actions
	STORE_CREATED = 'STORE_CREATED',
	STORE_UPDATED = 'STORE_UPDATED',
	STORE_DELETED = 'STORE_DELETED',
}

export enum AuditStatus {
	SUCCESS = 'SUCCESS',
	FAILURE = 'FAILURE',
	PENDING = 'PENDING',
}

@Schema({ timestamps: true })
export class AuditLog extends Document {
	@Prop({ type: String, enum: AuditAction, required: true, index: true })
	action: AuditAction;

	@Prop({ type: String, enum: AuditStatus, required: true, index: true })
	status: AuditStatus;

	@Prop({ type: Types.ObjectId, ref: 'User', index: true })
	userId?: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'Store', index: true })
	storeId?: Types.ObjectId;

	@Prop({ type: String })
	userEmail?: string;

	@Prop({ type: String })
	storeName?: string;

	@Prop({ type: Object })
	metadata?: Record<string, any>;

	@Prop({ type: String })
	errorMessage?: string;

	@Prop({ type: Object })
	errorDetails?: Record<string, any>;

	@Prop({ type: String })
	ipAddress?: string;

	@Prop({ type: String })
	userAgent?: string;

	@Prop({ type: Number })
	duration?: number; // in milliseconds

	createdAt: Date;
	updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ storeId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, status: 1, createdAt: -1 });
