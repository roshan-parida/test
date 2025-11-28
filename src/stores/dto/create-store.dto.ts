import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreDto {
	@ApiProperty({ example: 'storename', description: 'Store name' })
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({
		example: 'shpat_xxxxx',
		description: 'Shopify access token',
	})
	@IsString()
	@IsNotEmpty()
	shopifyToken: string;

	@ApiProperty({
		example: 'https://store.myshopify.com',
		description: 'Shopify store URL',
	})
	@IsUrl()
	@IsNotEmpty()
	shopifyStoreUrl: string;

	@ApiProperty({
		example: '987a6e54321',
		description: 'Facebook ad spend token',
	})
	@IsString()
	@IsNotEmpty()
	fbAdSpendToken: string;

	@ApiProperty({
		example: 'act_123456789',
		description: 'Facebook account ID',
	})
	@IsString()
	@IsNotEmpty()
	fbAccountId: string;
}
