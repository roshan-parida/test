import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditAction, AuditStatus } from './schemas/audit-log.schema';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
	constructor(private readonly auditService: AuditService) {}

	@Get()
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: 'Get all audit logs (Admin only)' })
	@ApiQuery({ name: 'action', required: false, enum: AuditAction })
	@ApiQuery({ name: 'status', required: false, enum: AuditStatus })
	@ApiQuery({ name: 'userId', required: false })
	@ApiQuery({ name: 'storeId', required: false })
	@ApiQuery({ name: 'startDate', required: false })
	@ApiQuery({ name: 'endDate', required: false })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiQuery({ name: 'skip', required: false, type: Number })
	@ApiResponse({ status: 200, description: 'Audit logs retrieved' })
	async findAll(
		@Query('action') action?: AuditAction,
		@Query('status') status?: AuditStatus,
		@Query('userId') userId?: string,
		@Query('storeId') storeId?: string,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('limit') limit?: number,
		@Query('skip') skip?: number,
	) {
		return this.auditService.findAll({
			action,
			status,
			userId,
			storeId,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			limit,
			skip,
		});
	}

	@Get('users/:userId')
	@Roles(UserRole.ADMIN)
	@ApiOperation({
		summary: 'Get audit logs for a specific user (Admin only)',
	})
	@ApiResponse({ status: 200, description: 'User audit logs retrieved' })
	async findByUser(
		@Param('userId') userId: string,
		@Query('limit') limit?: number,
	) {
		return this.auditService.findByUser(userId, limit);
	}

	@Get('stores/:storeId')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({ summary: 'Get audit logs for a specific store' })
	@ApiResponse({ status: 200, description: 'Store audit logs retrieved' })
	async findByStore(
		@Param('storeId') storeId: string,
		@Query('limit') limit?: number,
	) {
		return this.auditService.findByStore(storeId, limit);
	}

	@Get('stats')
	@Roles(UserRole.ADMIN)
	@ApiOperation({ summary: 'Get audit log statistics (Admin only)' })
	@ApiQuery({ name: 'startDate', required: false })
	@ApiQuery({ name: 'endDate', required: false })
	@ApiQuery({ name: 'storeId', required: false })
	@ApiResponse({ status: 200, description: 'Statistics retrieved' })
	async getStats(
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string,
		@Query('storeId') storeId?: string,
	) {
		return this.auditService.getStats({
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			storeId,
		});
	}
}
