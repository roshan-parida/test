import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { User } from './schemas/user.schema';
import { Invitation } from './schemas/invitation.schema';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from 'src/audit/audit.service';
import { AuditAction, AuditStatus } from 'src/audit/schemas/audit-log.schema';

interface CreateUserInput {
	name: string;
	email: string;
	password: string;
	role: UserRole;
	storeName: string;
	storeUrl: string;
}

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name)
		private readonly userModel: Model<User>,
		@InjectModel(Invitation.name)
		private readonly invitationModel: Model<Invitation>,
		private readonly auditService: AuditService,
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

	async findByStoreName(storeName: string): Promise<User | null> {
		return this.userModel.findOne({ storeName }).exec();
	}

	async updateRole(id: string, role: UserRole): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(id, { role }, { new: true })
			.exec();
		if (!user) throw new NotFoundException('User not found');

		await this.auditService.log({
			action: AuditAction.USER_ROLE_UPDATED,
			status: AuditStatus.SUCCESS,
			metadata: {
				userId: id,
				role: role,
			},
		});
		return user;
	}

	async setActiveStatus(id: string, isActive: boolean): Promise<User> {
		const user = await this.userModel
			.findByIdAndUpdate(id, { isActive }, { new: true })
			.exec();
		if (!user) throw new NotFoundException('User not found');

		await this.auditService.log({
			action: isActive
				? AuditAction.USER_ACTIVATED
				: AuditAction.USER_DEACTIVATED,
			status: AuditStatus.SUCCESS,
			metadata: {
				userId: id,
				status: isActive,
			},
		});
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

		await this.auditService.log({
			action: AuditAction.STORES_ASSIGNED,
			status: AuditStatus.SUCCESS,
			metadata: {
				userId: userId,
				storeIds: storeIds.map((id) => new Types.ObjectId(id)),
			},
		});
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

		await this.auditService.log({
			action: AuditAction.STORES_REMOVED,
			status: AuditStatus.SUCCESS,
			metadata: {
				userId: userId,
				storeIds: storeIds.map((id) => new Types.ObjectId(id)),
			},
		});
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

	async createInvitation(
		email: string,
		invitedBy: string,
		storeIds: string[],
		storeName: string,
		storeUrl: string,
		role: UserRole,
	): Promise<Invitation> {
		if (role !== UserRole.VIEWER) {
			throw new Error('Only users with the VIEWER role can be invited.');
		}

		// Delete any existing pending invitations for this email
		await this.invitationModel.deleteMany({ email, isAccepted: false });

		const token = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

		const invitation = new this.invitationModel({
			email,
			invitedBy: new Types.ObjectId(invitedBy),
			assignedStores: storeIds.map((id) => new Types.ObjectId(id)),
			storeName,
			storeUrl,
			token,
			expiresAt,
		});

		await this.auditService.log({
			action: AuditAction.INVITATION_SENT,
			status: AuditStatus.SUCCESS,
			metadata: {
				email: email,
				invitedBy: invitedBy,
				storeIds: storeIds.map((id) => new Types.ObjectId(id)),
			},
		});

		return invitation.save();
	}

	async findInvitationByToken(token: string): Promise<Invitation | null> {
		return this.invitationModel
			.findOne({ token, isAccepted: false })
			.populate('invitedBy', 'name email')
			.exec();
	}

	async acceptInvitation(token: string): Promise<Invitation> {
		const invitation = await this.invitationModel
			.findOneAndUpdate(
				{ token, isAccepted: false },
				{ isAccepted: true },
				{ new: true },
			)
			.exec();

		if (!invitation)
			throw new NotFoundException(
				'Invitation not found or already accepted',
			);
		return invitation;
	}

	async getViewersAssignedByManager(managerId: string): Promise<any[]> {
		const manager = await this.findById(managerId);

		if (!manager.assignedStores || manager.assignedStores.length === 0) {
			return [];
		}

		const managerStoreIds = manager.assignedStores.map((s) => s.toString());

		// Find all viewers who have access to any of the manager's stores
		const viewers = await this.userModel
			.find({
				role: UserRole.VIEWER,
				assignedStores: {
					$elemMatch: {
						$in: manager.assignedStores,
					},
				},
			})
			.select('-password -__v')
			.lean()
			.exec();

		// For each viewer, filter assignedStores to only show stores the manager manages
		return viewers.map((viewer) => ({
			...viewer,
			assignedStores: viewer.assignedStores
				.map((s: any) => s.toString())
				.filter((storeId: string) => managerStoreIds.includes(storeId)),
		}));
	}
}
