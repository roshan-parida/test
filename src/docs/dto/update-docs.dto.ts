import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsBoolean,
	IsNumber,
	IsArray,
	IsObject,
	MinLength,
	MaxLength,
	Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDocsDto {
	@ApiPropertyOptional({
		example: 'getting-started-updated',
		description: 'URL-friendly slug',
	})
	@IsString()
	@IsOptional()
	@MinLength(2)
	@MaxLength(100)
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: 'Slug must be lowercase with hyphens only',
	})
	slug?: string;

	@ApiPropertyOptional({
		example: 'Getting Started Guide',
		description: 'Document title',
	})
	@IsString()
	@IsOptional()
	@MinLength(3)
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({
		example: 'Updated description',
		description: 'Short description',
	})
	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@ApiPropertyOptional({
		description: 'Tiptap JSON content',
	})
	@IsObject()
	@IsOptional()
	content?: Record<string, any>;

	@ApiPropertyOptional({
		example: 'Tutorials',
		description: 'Category',
	})
	@IsString()
	@IsOptional()
	@MaxLength(100)
	category?: string;

	@ApiPropertyOptional({
		example: 2,
		description: 'Sort order',
	})
	@IsNumber()
	@IsOptional()
	order?: number;

	@ApiPropertyOptional({
		example: false,
		description: 'Published status',
	})
	@IsBoolean()
	@IsOptional()
	isPublished?: boolean;

	@ApiPropertyOptional({
		example: ['advanced', 'api'],
		description: 'Tags',
	})
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	tags?: string[];
}
