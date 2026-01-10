import { IsString, IsOptional, IsUrl, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreDto {
	@ApiPropertyOptional({ example: 'storename', description: 'Store name' })
	@IsString()
	@IsOptional()
	name?: string;

	@ApiPropertyOptional({
		example: 'https://example.com/logo.png',
		description: 'Store logo URL',
	})
	@IsOptional()
	@ValidateIf((o) => o.storeLogo !== null && o.storeLogo !== '')
	@IsUrl()
	storeLogo?: string;

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
	@IsOptional()
	@ValidateIf((o) => o.shopifyStoreUrl !== null && o.shopifyStoreUrl !== '')
	@IsUrl()
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
