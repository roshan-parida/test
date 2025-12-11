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

@Injectable()
export class StoresService {
	constructor(
		@InjectModel(Store.name)
		private readonly storeModel: Model<Store>,
		@Inject(forwardRef(() => MetricsService))
		private readonly metricsService: MetricsService,
		private readonly auditService: AuditService,
	) {}

	async create(dto: CreateStoreDto): Promise<Store> {
		const store = new this.storeModel(dto);

		await this.auditService.log({
			action: AuditAction.STORE_CREATED,
			status: AuditStatus.SUCCESS,
			metadata: { storeName: dto.name },
		});
		return store.save();
	}

	async findByName(name: string): Promise<Store | null> {
		return this.storeModel.findOne({ name }).exec();
	}

	async findAll(user?: any): Promise<Store[]> {
		if (!user || user.role === 'ADMIN' || user.role === UserRole.ADMIN) {
			return this.storeModel.find().exec();
		}

		const assigned = (user.assignedStores || []).map((id: any) =>
			id && id.toString ? id.toString() : String(id),
		);

		if (!assigned.length) return [];

		return this.storeModel
			.find({
				_id: { $in: assigned.map((id) => new Types.ObjectId(id)) },
			})
			.exec();
	}

	async findOne(id: string): Promise<Store> {
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
