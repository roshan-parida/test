import {
	Injectable,
	NotFoundException,
	ConflictException,
	ForbiddenException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store } from './schemas/store.schema';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { MetricsService } from '../metrics/metrics.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction, AuditStatus } from 'src/audit/schemas/audit-log.schema';
import { StoreStatus } from 'src/common/enums/store-status.enum';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class StoresService {
	constructor(
		@InjectModel(Store.name)
		private readonly storeModel: Model<Store>,
		@Inject(forwardRef(() => MetricsService))
		private readonly metricsService: MetricsService,
		private readonly mailService: MailService,
		private readonly auditService: AuditService,
	) {}

	async create(
		dto: CreateStoreDto,
		userId: string,
		userRole: UserRole,
	): Promise<Store> {
		// Check if store with this name already exists
		const existingStore = await this.findByName(dto.name);
		if (existingStore) {
			throw new ConflictException('Store name already exists');
		}

		const status =
			userRole === UserRole.ADMIN
				? StoreStatus.ACTIVE
				: StoreStatus.PENDING;

		const store = new this.storeModel({
			...dto,
			createdBy: new Types.ObjectId(userId),
			status,
		});

		await this.auditService.log({
			action: AuditAction.STORE_CREATED,
			status: AuditStatus.SUCCESS,
			userId,
			storeId: store._id.toString(),
			metadata: {
				storeName: dto.name,
				storeStatus: status,
				createdByRole: userRole,
			},
		});

		return store.save();
	}

	async findByName(name: string): Promise<Store | null> {
		return this.storeModel.findOne({ name }).exec();
	}

	async findAll(user?: any): Promise<Store[]> {
		const filter: any = {};

		// Admins see all stores, others only see ACTIVE stores
		if (!user || user.role !== UserRole.ADMIN) {
			filter.status = StoreStatus.ACTIVE;
		}

		if (!user || user.role === UserRole.ADMIN) {
			return this.storeModel
				.find(filter)
				.populate('createdBy', 'name email')
				.exec();
		}

		const assigned = (user.assignedStores || []).map((id: any) =>
			id && id.toString ? id.toString() : String(id),
		);

		if (!assigned.length) return [];

		filter._id = { $in: assigned.map((id) => new Types.ObjectId(id)) };

		return this.storeModel
			.find(filter)
			.populate('createdBy', 'name email')
			.exec();
	}

	async findOne(id: string): Promise<Store> {
		if (!Types.ObjectId.isValid(id)) {
			throw new NotFoundException('Store not found');
		}

		const store = await this.storeModel.findById(id).exec();
		if (!store) throw new NotFoundException('Store not found');
		return store;
	}

	async findOneForUser(id: string, user: any): Promise<Store> {
		const store = await this.findOne(id);
		if (user.role === UserRole.ADMIN || user.role === 'ADMIN') return store;

		if (!this.canAccessStore(user, id)) {
			throw new ForbiddenException(
				'You do not have access to this store',
			);
		}
		return store;
	}

	async findPendingStores(): Promise<Store[]> {
		return this.storeModel
			.find({ status: StoreStatus.PENDING })
			.populate('createdBy', 'name email')
			.exec();
	}

	async approveStore(storeId: string, adminId: string): Promise<Store> {
		const store = await this.storeModel
			.findByIdAndUpdate(
				storeId,
				{
					status: StoreStatus.ACTIVE,
					$unset: { rejectionReason: 1 },
				},
				{ new: true },
			)
			.populate('createdBy', 'name email')
			.exec();

		if (!store) {
			throw new NotFoundException('Store not found');
		}

		await this.auditService.log({
			action: AuditAction.STORE_UPDATED,
			status: AuditStatus.SUCCESS,
			userId: adminId,
			storeId: store._id.toString(),
			metadata: {
				action: 'APPROVED',
				storeName: store.name,
				approvedBy: adminId,
			},
		});

		return store;
	}

	async rejectStore(
		storeId: string,
		adminId: string,
		rejectionReason: string,
	): Promise<Store> {
		const store = await this.storeModel
			.findByIdAndUpdate(
				storeId,
				{
					status: StoreStatus.REJECTED,
					rejectionReason,
				},
				{ new: true },
			)
			.populate('createdBy', 'name email')
			.exec();

		if (!store) {
			throw new NotFoundException('Store not found');
		}

		await this.auditService.log({
			action: AuditAction.STORE_UPDATED,
			status: AuditStatus.SUCCESS,
			userId: adminId,
			storeId: store._id.toString(),
			metadata: {
				action: 'REJECTED',
				storeName: store.name,
				rejectedBy: adminId,
				rejectionReason,
			},
		});

		return store;
	}

	async update(id: string, dto: UpdateStoreDto): Promise<Store> {
		const store = await this.storeModel
			.findByIdAndUpdate(id, dto, { new: true })
			.exec();
		if (!store) throw new NotFoundException('Store not found');
		return store;
	}

	async updateForUser(
		id: string,
		dto: UpdateStoreDto,
		user: any,
	): Promise<Store> {
		if (user.role === UserRole.ADMIN || user.role === 'ADMIN') {
			await this.auditService.log({
				action: AuditAction.STORE_UPDATED,
				status: AuditStatus.SUCCESS,
				metadata: {
					storeId: id,
					updates: dto,
					by: [user._id, user.name],
				},
			});
			return this.update(id, dto);
		}

		if (user.role === UserRole.MANAGER || user.role === 'MANAGER') {
			if (!this.canAccessStore(user, id)) {
				throw new ForbiddenException(
					'You do not have permission to update this store',
				);
			}

			await this.auditService.log({
				action: AuditAction.STORE_UPDATED,
				status: AuditStatus.SUCCESS,
				metadata: {
					storeId: id,
					updates: dto,
					by: [user._id, user.name],
				},
			});
			return this.update(id, dto);
		}

		throw new ForbiddenException(
			'You do not have permission to update stores',
		);
	}

	async remove(id: string): Promise<void> {
		const store = await this.storeModel.findByIdAndDelete(id).exec();
		if (!store) throw new NotFoundException('Store not found');

		await this.auditService.log({
			action: AuditAction.STORE_CREATED,
			status: AuditStatus.SUCCESS,
			metadata: {
				storeId: id,
				storeName: store.name,
			},
		});

		// Clean up metrics for this store
		await this.metricsService.deleteByStoreId(id);
	}

	async saveOAuthCredentials(
		storeId: string,
		provider: 'shopify' | 'meta' | 'google',
		credentials: {
			accessToken: string;
			refreshToken?: string;
			expiresAt?: Date;
			additionalData?: any;
		},
	): Promise<Store> {
		const updateData: any = {};

		switch (provider) {
			case 'shopify':
				updateData.shopifyToken = credentials.accessToken;
				if (credentials.additionalData?.shopifyStoreUrl) {
					updateData.shopifyStoreUrl =
						credentials.additionalData.shopifyStoreUrl;
				}
				if (credentials.expiresAt) {
					updateData.shopifyTokenExpiresAt = credentials.expiresAt;
				}
				break;

			case 'meta':
				updateData.fbAdSpendToken = credentials.accessToken;
				if (credentials.refreshToken) {
					updateData.fbRefreshToken = credentials.refreshToken;
				}
				if (credentials.expiresAt) {
					updateData.fbTokenExpiresAt = credentials.expiresAt;
				}
				if (credentials.additionalData?.accountId) {
					updateData.fbAccountId =
						credentials.additionalData.accountId;
				}
				break;

			case 'google':
				// Google tokens would be stored here when implemented
				if (credentials.refreshToken) {
					updateData.googleRefreshToken = credentials.refreshToken;
				}
				if (credentials.expiresAt) {
					updateData.googleTokenExpiresAt = credentials.expiresAt;
				}
				if (credentials.additionalData?.customerId) {
					updateData.googleCustomerId =
						credentials.additionalData.customerId;
				}
				break;
		}

		return this.update(storeId, updateData);
	}

	canAccessStore(user: any, storeId: string): boolean {
		if (!user) return false;

		if (user.role === UserRole.ADMIN || user.role === 'ADMIN') return true;

		const assigned = (user.assignedStores || []).map((id: any) =>
			id && id.toString ? id.toString() : String(id),
		);

		return assigned.some((id: string) => id === storeId);
	}

	canManageStoreAccess(user: any): boolean {
		return [UserRole.ADMIN, UserRole.MANAGER, 'ADMIN', 'MANAGER'].includes(
			user?.role,
		);
	}
}
