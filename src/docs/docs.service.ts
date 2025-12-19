import {
	Injectable,
	NotFoundException,
	ConflictException,
	BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Docs } from './schemas/docs.schema';
import { CreateDocsDto } from './dto/create-docs.dto';
import { UpdateDocsDto } from './dto/update-docs.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditStatus } from '../audit/schemas/audit-log.schema';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class DocsService {
	constructor(
		@InjectModel(Docs.name)
		private readonly docsModel: Model<Docs>,
		private readonly auditService: AuditService,
	) {}

	// Create a new documentation article (Admin only)
	async create(dto: CreateDocsDto, userId: string): Promise<Docs> {
		const existing = await this.docsModel
			.findOne({ slug: dto.slug })
			.exec();

		if (existing) {
			throw new ConflictException(
				`Documentation with slug '${dto.slug}' already exists`,
			);
		}

		this.validateTiptapContent(dto.content);

		const doc = new this.docsModel({
			...dto,
			createdBy: new Types.ObjectId(userId),
			lastModifiedBy: new Types.ObjectId(userId),
			publishedAt: dto.isPublished ? new Date() : undefined,
		});

		await doc.save();

		await this.auditService.log({
			action: AuditAction.DOCS_CREATED,
			status: AuditStatus.SUCCESS,
			userId,
			metadata: {
				documentationId: doc._id.toString(),
				slug: doc.slug,
				title: doc.title,
				isPublished: doc.isPublished,
			},
		});

		return doc;
	}

	// Get all documentation - adapts based on user role
	async findAll(
		user: any,
		options?: {
			category?: string;
			isPublished?: boolean;
			search?: string;
		},
	): Promise<Docs[]> {
		const filter: any = {};
		const isAdmin = user?.role === UserRole.ADMIN;

		// Non-admins (including unauthenticated users) only see published docs
		if (!isAdmin) {
			filter.isPublished = true;
		} else {
			// Admins can filter by published status
			if (options?.isPublished !== undefined) {
				filter.isPublished = options.isPublished;
			}
		}

		if (options?.category) {
			filter.category = options.category;
		}

		// Text search on title, description, and tags
		if (options?.search) {
			filter.$or = [
				{ title: { $regex: options.search, $options: 'i' } },
				{ description: { $regex: options.search, $options: 'i' } },
				{ tags: { $in: [new RegExp(options.search, 'i')] } },
			];
		}

		const query = this.docsModel
			.find(filter)
			.sort({ category: 1, order: 1, title: 1 });

		// Populate creator info only for admins
		if (isAdmin) {
			query
				.populate('createdBy', 'name email')
				.populate('lastModifiedBy', 'name email');
		} else {
			query.select('-createdBy -lastModifiedBy');
		}

		return query.exec();
	}

	// Get documentation by slug - adapts based on user role
	async findBySlug(user: any, slug: string): Promise<Docs> {
		const filter: any = { slug };
		const isAdmin = user?.role === UserRole.ADMIN;

		// Non-admins only see published docs
		if (!isAdmin) {
			filter.isPublished = true;
		}

		const query = this.docsModel.findOne(filter);

		// Populate creator info only for admins
		if (isAdmin) {
			query
				.populate('createdBy', 'name email')
				.populate('lastModifiedBy', 'name email');
		} else {
			query.select('-createdBy -lastModifiedBy');
		}

		const doc = await query.exec();

		if (!doc) {
			throw new NotFoundException(
				`Documentation with slug '${slug}' not found`,
			);
		}

		return doc;
	}

	// Get documentation by ID (Admin only - used for editing)
	async findById(id: string): Promise<Docs> {
		if (!Types.ObjectId.isValid(id)) {
			throw new BadRequestException('Invalid documentation ID');
		}

		const doc = await this.docsModel
			.findById(id)
			.populate('createdBy', 'name email')
			.populate('lastModifiedBy', 'name email')
			.exec();

		if (!doc) {
			throw new NotFoundException('Documentation not found');
		}

		return doc;
	}

	// Get all unique categories - adapts based on user role
	async getCategories(user?: any): Promise<string[]> {
		const isAdmin = user?.role === UserRole.ADMIN;
		const filter = !isAdmin ? { isPublished: true } : {};

		const categories = await this.docsModel
			.distinct('category', filter)
			.exec();

		return categories.filter((c) => c); // Remove null/undefined
	}

	// Update documentation (Admin only)
	async update(
		id: string,
		dto: UpdateDocsDto,
		userId: string,
	): Promise<Docs> {
		const doc = await this.findById(id);

		// Check for slug conflicts if slug is being updated
		if (dto.slug && dto.slug !== doc.slug) {
			const existing = await this.docsModel
				.findOne({ slug: dto.slug })
				.exec();

			if (existing) {
				throw new ConflictException(
					`Documentation with slug '${dto.slug}' already exists`,
				);
			}
		}

		if (dto.content) {
			this.validateTiptapContent(dto.content);
		}

		// Set publishedAt when publishing for the first time
		const updates: any = {
			...dto,
			lastModifiedBy: new Types.ObjectId(userId),
		};

		if (dto.isPublished && !doc.isPublished) {
			updates.publishedAt = new Date();
		} else if (dto.isPublished === false) {
			updates.publishedAt = undefined;
		}

		const updated = await this.docsModel
			.findByIdAndUpdate(id, updates, { new: true })
			.populate('createdBy', 'name email')
			.populate('lastModifiedBy', 'name email')
			.exec();

		if (!updated) {
			throw new NotFoundException('Documentation not found');
		}

		await this.auditService.log({
			action: AuditAction.DOCS_UPDATED,
			status: AuditStatus.SUCCESS,
			userId,
			metadata: {
				documentationId: id,
				slug: updated.slug,
				title: updated.title,
				updates: dto,
			},
		});

		return updated;
	}

	// Delete documentation (Admin only)
	async delete(id: string, userId: string): Promise<void> {
		const doc = await this.findById(id);

		await this.docsModel.findByIdAndDelete(id).exec();

		await this.auditService.log({
			action: AuditAction.DOCS_DELETED,
			status: AuditStatus.SUCCESS,
			userId,
			metadata: {
				documentationId: id,
				slug: doc.slug,
				title: doc.title,
			},
		});
	}

	// Toggle published status (Admin only)
	async togglePublished(id: string, userId: string): Promise<Docs> {
		const doc = await this.findById(id);

		const updates: any = {
			isPublished: !doc.isPublished,
			lastModifiedBy: new Types.ObjectId(userId),
		};

		if (!doc.isPublished) {
			updates.publishedAt = new Date();
		} else {
			updates.publishedAt = undefined;
		}

		const updated = await this.docsModel
			.findByIdAndUpdate(id, updates, { new: true })
			.populate('createdBy', 'name email')
			.populate('lastModifiedBy', 'name email')
			.exec();

		if (!updated) {
			throw new NotFoundException('Documentation not found');
		}

		await this.auditService.log({
			action: AuditAction.DOCS_UPDATED,
			status: AuditStatus.SUCCESS,
			userId,
			metadata: {
				documentationId: id,
				slug: updated.slug,
				action: updated.isPublished ? 'published' : 'unpublished',
			},
		});

		return updated;
	}

	// Validate Tiptap JSON content structure
	private validateTiptapContent(content: Record<string, any>): void {
		if (!content.type || content.type !== 'doc') {
			throw new BadRequestException(
				'Invalid Tiptap content: must have type "doc"',
			);
		}

		if (!Array.isArray(content.content)) {
			throw new BadRequestException(
				'Invalid Tiptap content: must have content array',
			);
		}

		// Basic validation - Tiptap will handle detailed validation on frontend
	}
}
