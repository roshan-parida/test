import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Param,
	Body,
	Query,
	UseGuards,
	Req,
	HttpCode,
	HttpStatus,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
	ApiQuery,
} from '@nestjs/swagger';
import { DocsService } from './docs.service';
import { CreateDocsDto } from './dto/create-docs.dto';
import { UpdateDocsDto } from './dto/update-docs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';

@ApiTags('Documentation')
@Controller('docs')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DocsController {
	constructor(private readonly docsService: DocsService) {}

	@Get()
	@ApiOperation({
		summary: 'Get all documentation',
		description:
			'Returns all published documentation for public users. If authenticated as ADMIN, returns all documentation including drafts and allows filtering by published status.',
	})
	@ApiQuery({
		name: 'category',
		required: false,
		description: 'Filter by category',
	})
	@ApiQuery({
		name: 'isPublished',
		required: false,
		type: Boolean,
		description: 'Filter by published status (Admin only)',
	})
	@ApiQuery({
		name: 'search',
		required: false,
		description: 'Search in title, description, and tags',
	})
	@ApiResponse({
		status: 200,
		description: 'Documentation retrieved successfully',
	})
	async getAllDocs(
		@Req() req: any,
		@Query('category') category?: string,
		@Query('isPublished') isPublishedStr?: string,
		@Query('search') search?: string,
	) {
		let isPublished: boolean | undefined;
		if (isPublishedStr !== undefined) {
			isPublished = isPublishedStr === 'true';
		}

		return this.docsService.findAll(req.user, {
			category,
			isPublished,
			search,
		});
	}

	@Get('categories')
	@ApiOperation({
		summary: 'Get all documentation categories',
		description:
			'Returns a unique list of all documentation categories. Public users see categories from published articles only, while admins see all categories.',
	})
	@ApiResponse({
		status: 200,
		description: 'Categories retrieved successfully',
		schema: {
			type: 'array',
			items: { type: 'string' },
			example: ['Getting Started', 'Features', 'API Reference'],
		},
	})
	async getCategories(@Req() req: any) {
		return this.docsService.getCategories(req.user);
	}

	@Get('slug/:slug')
	@ApiOperation({
		summary: 'Get documentation by slug',
		description:
			'Returns a single documentation article by its slug. Public users see published articles only, while admins can also retrieve drafts.',
	})
	@ApiParam({
		name: 'slug',
		description: 'URL-friendly slug',
		example: 'getting-started',
	})
	@ApiResponse({
		status: 200,
		description: 'Documentation found',
	})
	@ApiResponse({
		status: 404,
		description: 'Documentation not found',
	})
	async getBySlug(@Req() req: any, @Param('slug') slug: string) {
		return this.docsService.findBySlug(req.user, slug);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Get documentation by ID (Admin only)',
		description:
			'Returns any documentation article by its ID, including drafts. Used for editing.',
	})
	@ApiParam({
		name: 'id',
		description: 'Documentation ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Documentation found',
	})
	@ApiResponse({
		status: 404,
		description: 'Documentation not found',
	})
	async getById(@Param('id') id: string) {
		return this.docsService.findById(id);
	}

	@Post()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Create new documentation (Admin only)',
		description:
			'Create a new documentation article with Tiptap JSON content.',
	})
	@ApiResponse({
		status: 201,
		description: 'Documentation created successfully',
	})
	@ApiResponse({
		status: 409,
		description: 'Documentation with this slug already exists',
	})
	async create(@Body() dto: CreateDocsDto, @Req() req: any) {
		return this.docsService.create(dto, req.user.userId);
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Update documentation (Admin only)',
		description: 'Update an existing documentation article.',
	})
	@ApiParam({
		name: 'id',
		description: 'Documentation ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Documentation updated successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Documentation not found',
	})
	async update(
		@Param('id') id: string,
		@Body() dto: UpdateDocsDto,
		@Req() req: any,
	) {
		return this.docsService.update(id, dto, req.user.userId);
	}

	@Patch(':id/toggle-publish')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Toggle documentation published status (Admin only)',
		description: 'Quickly publish or unpublish a documentation article.',
	})
	@ApiParam({
		name: 'id',
		description: 'Documentation ID',
	})
	@ApiResponse({
		status: 200,
		description: 'Published status toggled successfully',
	})
	async togglePublish(@Param('id') id: string, @Req() req: any) {
		return this.docsService.togglePublished(id, req.user.userId);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	@ApiBearerAuth('JWT-auth')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: 'Delete documentation (Admin only)',
		description: 'Permanently delete a documentation article.',
	})
	@ApiParam({
		name: 'id',
		description: 'Documentation ID',
	})
	@ApiResponse({
		status: 204,
		description: 'Documentation deleted successfully',
	})
	@ApiResponse({
		status: 404,
		description: 'Documentation not found',
	})
	async delete(@Param('id') id: string, @Req() req: any) {
		await this.docsService.delete(id, req.user.userId);
	}
}
