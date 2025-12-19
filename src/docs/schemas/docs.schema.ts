import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Docs extends Document {
	@Prop({ required: true, unique: true })
	slug: string; // (e.g., 'getting-started', 'analytics-guide')

	@Prop({ required: true })
	title: string;

	@Prop({ required: false })
	description?: string; // Short summary for listing pages

	@Prop({ type: Object, required: true })
	content: Record<string, any>; // Tiptap JSON content

	@Prop({ required: false })
	category?: string; // e.g., 'Getting Started', 'Features', 'API Reference'

	@Prop({ default: 0 })
	order: number; // For sorting within categories

	@Prop({ default: true })
	isPublished: boolean; // Draft vs Published state

	@Prop({ type: [String], default: [] })
	tags: string[]; // For searchability

	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	createdBy: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'User' })
	lastModifiedBy?: Types.ObjectId;

	@Prop({ type: Date })
	publishedAt?: Date;

	createdAt: Date;
	updatedAt: Date;
}

export const DocsSchema = SchemaFactory.createForClass(Docs);

// Indexes for efficient querying
DocsSchema.index({ category: 1, order: 1 });
DocsSchema.index({ isPublished: 1, category: 1, order: 1 });
DocsSchema.index({ tags: 1 });
DocsSchema.index({ title: 'text', description: 'text' });
