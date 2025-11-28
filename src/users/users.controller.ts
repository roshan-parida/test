import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	@ApiOperation({ summary: 'Get all users (Admin only)' })
	@ApiResponse({ status: 200, description: 'List of all users' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
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
	@ApiOperation({ summary: 'Update user role (Admin only)' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiResponse({ status: 200, description: 'User role updated successfully' })
	@ApiResponse({ status: 404, description: 'User not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
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
	@ApiOperation({ summary: 'Set user active status (Admin only)' })
	@ApiParam({ name: 'userId', description: 'User ID' })
	@ApiResponse({
		status: 200,
		description: 'User status updated successfully',
	})
	@ApiResponse({ status: 404, description: 'User not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
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
}
