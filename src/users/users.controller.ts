import {
	Controller,
	Get,
	Patch,
	Param,
	Body,
	UseGuards,
	Delete,
	ForbiddenException,
	Post,
	Req,
	NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { StoresService } from '../stores/stores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { AssignStoresDto } from './dto/assign-stores.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly storesService: StoresService,
	) {}

	@Get()
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: 'Get all users (Admin only)' })
	async findAll() {
		const users = await this.usersService.findAll();
		return users.map((u) => {
			const obj = u.toObject();
			delete obj.password;
			delete obj.__v;
			return obj;
		});
	}

	@Patch(':userId/role')
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: 'Update user role (Admin only)' })
	async updateRole(
		@Param('userId') userId: string,
		@Body() dto: UpdateUserRoleDto,
	) {
		const user = await this.usersService.updateRole(userId, dto.role);
		const obj = user.toObject();
		delete obj.password;
		delete obj.__v;
		return obj;
	}

	@Patch(':userId/active')
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: 'Set user active status (Admin only)' })
	async setActive(
		@Param('userId') userId: string,
		@Body() dto: SetUserActiveDto,
	) {
		const user = await this.usersService.setActiveStatus(
			userId,
			dto.isActive,
		);
		const obj = user.toObject();
		delete obj.password;
		delete obj.__v;
		return obj;
	}

	@Post(':userId/stores')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({ summary: 'Assign stores to user (Admin/Manager)' })
	async assignStores(
		@Param('userId') userId: string,
		@Body() dto: AssignStoresDto,
		@Req() req: any,
	) {
		await this.usersService.findById(userId);

		if (req.user.role === UserRole.MANAGER) {
			const managerStores =
				req.user.assignedStores && req.user.assignedStores.length
					? req.user.assignedStores.map((s: any) => s.toString())
					: (
							await this.usersService.getUserStores(
								req.user.userId,
							)
						).map((s: any) => s.toString());

			const unauthorized = dto.storeIds.some(
				(id) => !managerStores.includes(id),
			);
			if (unauthorized) {
				throw new ForbiddenException(
					'Managers can only assign stores they are assigned to',
				);
			}
		}

		const user = await this.usersService.assignStores(userId, dto.storeIds);
		const obj = user.toObject();
		delete obj.password;
		delete obj.__v;
		return obj;
	}

	@Delete(':userId/stores')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({ summary: 'Remove stores from user (Admin/Manager)' })
	async removeStores(
		@Param('userId') userId: string,
		@Body() dto: AssignStoresDto,
		@Req() req: any,
	) {
		await this.usersService.findById(userId);

		if (req.user.role === UserRole.MANAGER) {
			const managerStores =
				req.user.assignedStores && req.user.assignedStores.length
					? req.user.assignedStores.map((s: any) => s.toString())
					: (
							await this.usersService.getUserStores(
								req.user.userId,
							)
						).map((s: any) => s.toString());

			const unauthorized = dto.storeIds.some(
				(id) => !managerStores.includes(id),
			);
			if (unauthorized) {
				throw new ForbiddenException(
					'Managers can only remove stores they are assigned to',
				);
			}
		}

		const user = await this.usersService.removeStores(userId, dto.storeIds);
		const obj = user.toObject();
		delete obj.password;
		delete obj.__v;
		return obj;
	}

	@Get('me/stores')
	@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
	@ApiOperation({ summary: 'Get stores assigned to the current user' })
	async getMyStores(@Req() req: any) {
		const stores = await this.usersService.getUserStores(req.user.userId);
		return stores;
	}

	@Get('store/:storeId/users')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({
		summary: 'Get users assigned to a store (Admin or assigned Manager)',
	})
	async getUsersByStore(@Param('storeId') storeId: string, @Req() req: any) {
		if (req.user.role === UserRole.MANAGER) {
			const managerStores =
				req.user.assignedStores && req.user.assignedStores.length
					? req.user.assignedStores.map((s: any) => s.toString())
					: (
							await this.usersService.getUserStores(
								req.user.userId,
							)
						).map((s: any) => s.toString());

			if (!managerStores.includes(storeId)) {
				throw new ForbiddenException(
					'You do not have access to view users for this store',
				);
			}
		}

		try {
			await this.storesService.findOne(storeId);
		} catch (e) {
			throw new NotFoundException('Store not found');
		}

		return this.usersService.getUsersByStore(storeId);
	}
}
