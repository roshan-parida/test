import {
	IsEmail,
	IsString,
	MinLength,
	IsNotEmpty,
	IsUrl,
	IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
	@ApiProperty({
		example: 'John Doe',
		description: 'Full Name',
	})
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({
		example: 'user@example.com',
		description: 'User email address',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		example: 'password123',
		description: 'Password (min 8 characters)',
	})
	@IsString()
	@MinLength(8)
	password: string;

	@ApiProperty({
		example: '+911234567890',
		description: 'Phone number',
		required: false,
	})
	@IsString()
	@IsOptional()
	phone?: string;

	@ApiProperty({
		example: 'https://example.com/profile.jpg',
		description: 'Profile image URL',
		required: false,
	})
	@IsUrl()
	@IsOptional()
	profileImage?: string;

	@ApiProperty({ example: 'My Store', description: 'Store name' })
	@IsString()
	@IsNotEmpty()
	storeName: string;

	@ApiProperty({
		example: 'mystore.myshopify.com',
		description: 'Shopify store URL',
	})
	@IsUrl()
	@IsNotEmpty()
	storeUrl: string;

	@ApiProperty({
		example: 'https://example.com/logo.png',
		description: 'Store logo URL',
		required: false,
	})
	@IsUrl()
	@IsOptional()
	storeLogo?: string;
}
