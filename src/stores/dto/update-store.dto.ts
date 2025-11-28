import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreDto {
	@ApiPropertyOptional({ example: 'storename', description: 'Store name' })
	@IsString()
	@IsOptional()
	name?: string;

	@ApiPropertyOptional({
		example: 'shpat_xxxxx',
		description: 'Shopify access token',
	})
	@IsString()
	@IsOptional()
	shopifyToken?: string;

	@ApiPropertyOptional({
		example: 'https://store.myshopify.com',
		description: 'Shopify store URL',
	})
	@IsUrl()
	@IsOptional()
	shopifyStoreUrl?: string;

	@ApiPropertyOptional({
		example: '987a6e54321',
		description: 'Facebook ad spend token',
	})
	@IsString()
	@IsOptional()
	fbAdSpendToken?: string;

	@ApiPropertyOptional({
		example: 'act_123456789',
		description: 'Facebook account ID',
	})
	@IsString()
	@IsOptional()
	fbAccountId?: string;
}
