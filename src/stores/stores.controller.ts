import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Param,
	Body,
	UseGuards,
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

@ApiTags('Stores')
@ApiBearerAuth('JWT-auth')
@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
	constructor(private readonly storesService: StoresService) {}

	@Get()
	@ApiOperation({ summary: 'Get all stores' })
	@ApiResponse({ status: 200, description: 'List of all stores' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async findAll() {
		return this.storesService.findAll();
	}

	@Get(':storeId')
	@ApiOperation({ summary: 'Get a store by ID' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 200, description: 'Store found' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	async findOne(@Param('storeId') storeId: string) {
		return this.storesService.findOne(storeId);
	}

	@Post()
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({ summary: 'Create a new store (Admin/Manager only)' })
	@ApiResponse({ status: 201, description: 'Store created successfully' })
	@ApiResponse({ status: 409, description: 'Store name already exists' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	async create(@Body() dto: CreateStoreDto) {
		const store = await this.storesService.create(dto);
		const obj = store.toObject();
		return obj;
	}

	@Patch(':storeId')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiOperation({ summary: 'Update a store (Admin/Manager only)' })
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiResponse({ status: 200, description: 'Store updated successfully' })
	@ApiResponse({ status: 404, description: 'Store not found' })
	@ApiResponse({ status: 403, description: 'Forbidden' })
	async update(
		@Param('storeId') storeId: string,
		@Body() dto: UpdateStoreDto,
	) {
		return this.storesService.update(storeId, dto);
	}

	@Delete(':storeId')
	@Roles(UserRole.ADMIN)
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
