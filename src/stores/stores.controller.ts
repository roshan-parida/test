import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Param,
	Body,
	UseGuards,
	Req,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
} from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';

@ApiTags('Stores')
@ApiBearerAuth('JWT-auth')
@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
	constructor(private readonly storesService: StoresService) {}

	@Get()
	@UseGuards(StoreAccessGuard)
	@ApiOperation({ summary: 'Get stores visible to the requester' })
	@ApiResponse({ status: 200, description: 'List of stores' })
	async findAll(@Req() req: any) {
		return this.storesService.findAll(req.user);
	}

	@Get(':storeId')
	@UseGuards(StoreAccessGuard)
	@ApiOperation({ summary: 'Get a store by ID' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 200, description: 'Store found' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	async findOne(@Param('storeId') storeId: string, @Req() req: any) {
		return this.storesService.findOneForUser(storeId, req.user);
	}

	@Post()
	@Roles(UserRole.ADMIN)
	@UseGuards(StoreAccessGuard)
	@ApiOperation({ summary: 'Create a new store (Admin only)' })
	@ApiResponse({ status: 201, description: 'Store created successfully' })
	@ApiResponse({ status: 409, description: 'Store name already exists' })
	async create(@Body() dto: CreateStoreDto) {
		const store = await this.storesService.create(dto);
		const obj = store.toObject();
		return obj;
	}

	@Patch(':storeId')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseGuards(StoreAccessGuard)
	@ApiOperation({
		summary: 'Update a store (Admin or assigned Manager only)',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 200, description: 'Store updated successfully' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	async update(
		@Param('storeId') storeId: string,
		@Body() dto: UpdateStoreDto,
		@Req() req: any,
	) {
		return this.storesService.updateForUser(storeId, dto, req.user);
	}

	@Delete(':storeId')
	@Roles(UserRole.ADMIN)
	@UseGuards(StoreAccessGuard)
	@ApiOperation({ summary: 'Delete a store (Admin only)' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 204, description: 'Store deleted successfully' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	async remove(@Param('storeId') storeId: string) {
		await this.storesService.remove(storeId);
		return { statusCode: 204 };
	}
}
