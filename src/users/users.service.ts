import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { UserRole } from '../common/enums/user-role.enum';

interface CreateUserInput {
	email: string;
	password: string;
	role: UserRole;
}

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name)
		private readonly userModel: Model<User>,
	) {}

	async create(data: CreateUserInput): Promise<User> {
		const user = new this.userModel(data);
		return user.save();
	}

	async findAll(): Promise<User[]> {
		return this.userModel.find().exec();
	}

	async findById(id: string): Promise<User> {
		const user = await this.userModel.findById(id).exec();
		if (!user) throw new NotFoundException('User not found');
		return user;
	}

	async findByEmail(email: string): Promise<User | null> {
		return this.userModel.findOne({ email }).exec();
	}

	async updateRole(id: string, role: UserRole): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(id, { role }, { new: true })
			.exec();
		if (!user) throw new NotFoundException('User not found');
		return user;
	}

	async setActiveStatus(id: string, isActive: boolean): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(id, { isActive }, { new: true })
			.exec();
		if (!user) throw new NotFoundException('User not found');
		return user;
	}

	async assignStores(userId: string, storeIds: string[]): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(
				userId,
				{
					$addToSet: {
						assignedStores: {
							$each: storeIds.map((id) => new Types.ObjectId(id)),
						},
					},
				},
				{ new: true },
			)
			.exec();

		if (!user) throw new NotFoundException('User not found');
		return user;
	}

	async removeStores(userId: string, storeIds: string[]): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(
				userId,
				{
					$pull: {
						assignedStores: {
							$in: storeIds.map((id) => new Types.ObjectId(id)),
						},
					},
				},
				{ new: true },
			)
			.exec();

		if (!user) throw new NotFoundException('User not found');
		return user;
	}

	async getUserStores(userId: string): Promise<string[]> {
		const user = await this.findById(userId);
		return (user.assignedStores || []).map((s: any) => s.toString());
	}

	async getUsersByStore(storeId: string): Promise<any[]> {
		return this.userModel
			.find({ assignedStores: new Types.ObjectId(storeId) })
			.select('-password -__v')
			.exec();
	}
}
