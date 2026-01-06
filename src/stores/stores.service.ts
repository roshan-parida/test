import {
	Injectable,
	NotFoundException,
	ConflictException,
	ForbiddenException,
	Inject,
	forwardRef,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	private readonly logger = new Logger(StoresService.name);

	constructor(
		@InjectModel(Store.name)
		private readonly storeModel: Model<Store>,
		@Inject(forwardRef(() => MetricsService))
		private readonly configService: ConfigService,
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
			expiresIn?: number; // seconds
			additionalData?: any;
		},
	): Promise<Store> {
		const updateData: any = {};

		// Calculate expiration date if expiresIn is provided
		let expirationDate: Date | undefined = credentials.expiresAt;
		if (!expirationDate && credentials.expiresIn) {
			expirationDate = new Date(
				Date.now() + credentials.expiresIn * 1000,
			);
		}

		switch (provider) {
			case 'shopify':
				updateData.shopifyToken = credentials.accessToken;
				if (credentials.additionalData?.shopifyStoreUrl) {
					updateData.shopifyStoreUrl =
						credentials.additionalData.shopifyStoreUrl;
				}
				if (expirationDate) {
					updateData.shopifyTokenExpiresAt = expirationDate;
				}
				break;

			case 'meta':
				updateData.fbAdSpendToken = credentials.accessToken;
				if (credentials.refreshToken) {
					updateData.fbRefreshToken = credentials.refreshToken;
				}
				if (expirationDate) {
					updateData.fbTokenExpiresAt = expirationDate;
				}
				if (credentials.additionalData?.accountId) {
					updateData.fbAccountId =
						credentials.additionalData.accountId;
				}
				break;

			case 'google':
				// Store both access and refresh tokens
				updateData.googleAccessToken = credentials.accessToken;

				if (credentials.refreshToken) {
					updateData.googleRefreshToken = credentials.refreshToken;
				}

				if (expirationDate) {
					updateData.googleTokenExpiresAt = expirationDate;
				}

				if (credentials.additionalData?.customerId) {
					// Clean up customer ID (remove dashes if present)
					const cleanCustomerId =
						credentials.additionalData.customerId.replace(/-/g, '');
					updateData.googleCustomerId = cleanCustomerId;
				}

				this.logger.log(
					`Saved Google OAuth credentials for store ${storeId}. ` +
						`Customer ID: ${updateData.googleCustomerId || 'not set'}, ` +
						`Has refresh token: ${!!credentials.refreshToken}, ` +
						`Expires at: ${expirationDate?.toISOString() || 'not set'}`,
				);
				break;
		}

		await this.auditService.log({
			action: AuditAction.STORE_UPDATED,
			status: AuditStatus.SUCCESS,
			storeId,
			metadata: {
				action: 'oauth_credentials_saved',
				provider,
				hasRefreshToken: !!credentials.refreshToken,
				expiresAt: expirationDate?.toISOString(),
			},
		});

		return this.update(storeId, updateData);
	}

	async getValidGoogleToken(store: Store): Promise<string> {
		const now = new Date();

		// If we have an access token and it's not expired (with 5-minute buffer)
		if (store.googleAccessToken && store.googleTokenExpiresAt) {
			const expiresAt = new Date(store.googleTokenExpiresAt);
			const bufferTime = new Date(expiresAt.getTime() - 5 * 60 * 1000); // 5 minutes before expiry

			if (now < bufferTime) {
				return store.googleAccessToken;
			}
		}

		// Token expired or not present, need to refresh
		if (!store.googleRefreshToken) {
			throw new Error(
				'Google refresh token not found. Please re-authenticate.',
			);
		}

		this.logger.log(
			`Refreshing Google access token for store ${store.name}`,
		);

		try {
			// Import OAuthService dynamically or inject it
			// For now, we'll do the refresh inline
			const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
			const clientSecret = this.configService.get<string>(
				'GOOGLE_CLIENT_SECRET',
			);

			const response = await fetch(
				'https://oauth2.googleapis.com/token',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						refresh_token: store.googleRefreshToken,
						client_id: clientId,
						client_secret: clientSecret,
						grant_type: 'refresh_token',
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Token refresh failed: ${response.statusText}`);
			}

			const data = await response.json();

			// Save the new access token
			await this.saveOAuthCredentials(store._id.toString(), 'google', {
				accessToken: data.access_token,
				expiresIn: data.expires_in,
				refreshToken: store.googleRefreshToken, // Keep the same refresh token
				additionalData: {
					customerId: store.googleCustomerId,
				},
			});

			return data.access_token;
		} catch (error) {
			this.logger.error(
				`Failed to refresh Google token: ${(error as any).message}`,
			);
			throw new Error(
				'Failed to refresh Google access token. Please re-authenticate.',
			);
		}
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
