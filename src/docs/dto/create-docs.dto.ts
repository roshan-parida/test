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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocsDto {
	@ApiProperty({
		example: 'getting-started',
		description: 'URL-friendly slug (lowercase, hyphens only)',
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(2)
	@MaxLength(100)
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message:
			'Slug must be lowercase with hyphens only (e.g., getting-started)',
	})
	slug: string;

	@ApiProperty({
		example: 'Getting Started with Ad Matrix',
		description: 'Document title',
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(3)
	@MaxLength(200)
	title: string;

	@ApiPropertyOptional({
		example: 'Learn how to set up and configure your Ad Matrix account',
		description: 'Short description for listing pages',
	})
	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@ApiProperty({
		example: {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Hello world' }],
				},
			],
		},
		description: 'Tiptap JSON content',
	})
	@IsObject()
	@IsNotEmpty()
	content: Record<string, any>;

	@ApiPropertyOptional({
		example: 'Getting Started',
		description: 'Category for grouping documents',
	})
	@IsString()
	@IsOptional()
	@MaxLength(100)
	category?: string;

	@ApiPropertyOptional({
		example: 1,
		description: 'Sort order within category (lower numbers first)',
	})
	@IsNumber()
	@IsOptional()
	order?: number;

	@ApiPropertyOptional({
		example: true,
		description: 'Whether the document is published',
	})
	@IsBoolean()
	@IsOptional()
	isPublished?: boolean;

	@ApiPropertyOptional({
		example: ['setup', 'tutorial', 'beginner'],
		description: 'Tags for searchability',
	})
	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	tags?: string[];
}
