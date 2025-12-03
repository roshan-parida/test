import {
	Injectable,
	NotFoundException,
	ConflictException,
	ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store } from './schemas/store.schema';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { MetricsService } from '../metrics/metrics.service';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class StoresService {
	constructor(
		@InjectModel(Store.name)
		private readonly storeModel: Model<Store>,
		private readonly metricsService: MetricsService,
	) {}

	async create(dto: CreateStoreDto): Promise<Store> {
		const existing = await this.storeModel
			.findOne({ name: dto.name })
			.exec();
		if (existing) throw new ConflictException('Store name already exists');

		const store = new this.storeModel(dto);
		return store.save();
	}

	async findAll(user?: any): Promise<Store[]> {
		if (!user || user.role === UserRole.ADMIN) {
			return this.storeModel.find().exec();
		}

		const assigned = (user.assignedStores || []).map((id: any) =>
			id.toString(),
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
		if (user.role === UserRole.ADMIN) return store;

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
		if (user.role === UserRole.ADMIN) {
			return this.update(id, dto);
		}

		if (user.role === UserRole.MANAGER) {
			if (!this.canAccessStore(user, id)) {
				throw new ForbiddenException(
					'You do not have permission to update this store',
				);
			}
			return this.update(id, dto);
		}

		throw new ForbiddenException(
			'You do not have permission to update stores',
		);
	}

	async remove(id: string): Promise<void> {
		const store = await this.storeModel.findByIdAndDelete(id).exec();
		if (!store) throw new NotFoundException('Store not found');
		// Clean up metrics for this store
		await this.metricsService.deleteByStoreId(id);
	}

	canAccessStore(user: any, storeId: string): boolean {
		if (!user) return false;

		if (user.role === UserRole.ADMIN) return true;

		const assigned = (user.assignedStores || []).map((id: any) =>
			id && id.toString ? id.toString() : String(id),
		);

		return assigned.some((id: string) => id === storeId);
	}

	canManageStoreAccess(user: any): boolean {
		return [UserRole.ADMIN, UserRole.MANAGER].includes(user?.role);
	}
}
