import { IsString, IsNotEmpty, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreDto {
	@ApiProperty({ example: 'storename', description: 'Store name' })
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({
		example: 'https://example.com/logo.png',
		description: 'Store logo URL',
		required: false,
	})
	@IsUrl()
	@IsOptional()
	storeLogo?: string;

	@ApiProperty({
		example: 'shpat_xxxxx',
		description: 'Shopify access token (optional if using OAuth)',
		required: false,
	})
	@IsString()
	@IsOptional()
	shopifyToken?: string;

	@ApiProperty({
		example: 'https://store.myshopify.com',
		description: 'Shopify store URL',
	})
	@IsUrl()
	@IsNotEmpty()
	shopifyStoreUrl: string;

	@ApiProperty({
		example: '987a6e54321',
		description: 'Facebook ad spend token (optional if using OAuth)',
		required: false,
	})
	@IsString()
	@IsOptional()
	fbAdSpendToken?: string;

	@ApiProperty({
		example: 'act_123456789',
		description: 'Facebook account ID (optional if using OAuth)',
		required: false,
	})
	@IsString()
	@IsOptional()
	fbAccountId?: string;
}
