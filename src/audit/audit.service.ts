import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditAction, AuditStatus } from './schemas/audit-log.schema';

export interface CreateAuditLogInput {
	action: AuditAction;
	status: AuditStatus;
	userId?: string;
	storeId?: string;
	userEmail?: string;
	storeName?: string;
	metadata?: Record<string, any>;
	errorMessage?: string;
	errorDetails?: Record<string, any>;
	ipAddress?: string;
	userAgent?: string;
	duration?: number;
}

@Injectable()
export class AuditService {
	private readonly logger = new Logger(AuditService.name);

	constructor(
		@InjectModel(AuditLog.name)
		private readonly auditLogModel: Model<AuditLog>,
	) {}

	async log(input: CreateAuditLogInput): Promise<void> {
		try {
			const auditLog = new this.auditLogModel({
				...input,
				userId: input.userId
					? new Types.ObjectId(input.userId)
					: undefined,
				storeId: input.storeId
					? new Types.ObjectId(input.storeId)
					: undefined,
			});

			await auditLog.save();

			// Log to console for debugging
			const logMessage = `[AUDIT] ${input.action} - ${input.status}${input.userEmail ? ` - ${input.userEmail}` : ''}${input.storeName ? ` - ${input.storeName}` : ''}`;

			if (input.status === AuditStatus.FAILURE) {
				this.logger.error(`${logMessage}: ${input.errorMessage}`);
			} else {
				this.logger.log(logMessage);
			}
		} catch (error) {
			// Don't let audit logging failures break the main flow
			this.logger.error(
				`Failed to create audit log: ${(error as any).message}`,
			);
		}
	}

	async findAll(filters?: {
		action?: AuditAction;
		status?: AuditStatus;
		userId?: string;
		storeId?: string;
		startDate?: Date;
		endDate?: Date;
		limit?: number;
		skip?: number;
	}): Promise<{ logs: AuditLog[]; total: number }> {
		const query: any = {};

		if (filters?.action) query.action = filters.action;
		if (filters?.status) query.status = filters.status;
		if (filters?.userId) query.userId = new Types.ObjectId(filters.userId);
		if (filters?.storeId)
			query.storeId = new Types.ObjectId(filters.storeId);

		if (filters?.startDate || filters?.endDate) {
			query.createdAt = {};
			if (filters.startDate) query.createdAt.$gte = filters.startDate;
			if (filters.endDate) query.createdAt.$lte = filters.endDate;
		}

		const limit = filters?.limit || 100;
		const skip = filters?.skip || 0;

		const [logs, total] = await Promise.all([
			this.auditLogModel
				.find(query)
				.sort({ createdAt: -1 })
				.limit(limit)
				.skip(skip)
				.populate('userId', 'name email')
				.populate('storeId', 'name')
				.exec(),
			this.auditLogModel.countDocuments(query).exec(),
		]);

		return { logs, total };
	}

	async findByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
		return this.auditLogModel
			.find({ userId: new Types.ObjectId(userId) })
			.sort({ createdAt: -1 })
			.limit(limit)
			.populate('storeId', 'name')
			.exec();
	}

	async findByStore(
		storeId: string,
		limit: number = 50,
	): Promise<AuditLog[]> {
		return this.auditLogModel
			.find({ storeId: new Types.ObjectId(storeId) })
			.sort({ createdAt: -1 })
			.limit(limit)
			.populate('userId', 'name email')
			.exec();
	}

	async getStats(filters?: {
		startDate?: Date;
		endDate?: Date;
		storeId?: string;
	}): Promise<any> {
		const matchStage: any = {};

		if (filters?.startDate || filters?.endDate) {
			matchStage.createdAt = {};
			if (filters.startDate)
				matchStage.createdAt.$gte = filters.startDate;
			if (filters.endDate) matchStage.createdAt.$lte = filters.endDate;
		}

		if (filters?.storeId) {
			matchStage.storeId = new Types.ObjectId(filters.storeId);
		}

		const pipeline: any[] = [
			{ $match: matchStage },
			{
				$group: {
					_id: {
						action: '$action',
						status: '$status',
					},
					count: { $sum: 1 },
				},
			},
			{
				$group: {
					_id: '$_id.action',
					statuses: {
						$push: {
							status: '$_id.status',
							count: '$count',
						},
					},
					total: { $sum: '$count' },
				},
			},
			{ $sort: { total: -1 as const } },
		];

		return this.auditLogModel.aggregate(pipeline).exec();
	}
}
