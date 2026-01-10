import {
	IsEmail,
	IsString,
	MinLength,
	IsNotEmpty,
	IsUrl,
	IsOptional,
	ValidateIf,
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
		required: true,
	})
	@IsString()
	phone: string;

	@ApiProperty({
		example: 'https://example.com/profile.jpg',
		description: 'Profile image URL',
		required: false,
	})
	@IsOptional()
	@ValidateIf((o) => o.profileImage !== null && o.profileImage !== '')
	@IsUrl()
	profileImage?: string;

	@ApiProperty({ example: 'My Store', description: 'Store name' })
	@IsString()
	@IsNotEmpty()
	storeName: string;

	@ApiProperty({
		example: 'mystore.myshopify.com',
		description: 'Shopify store URL',
	})
	@IsNotEmpty()
	@ValidateIf((o) => o.storeUrl !== null && o.storeUrl !== '')
	@IsUrl()
	storeUrl: string;

	@ApiProperty({
		example: 'https://example.com/logo.png',
		description: 'Store logo URL',
		required: false,
	})
	@IsOptional()
	@ValidateIf((o) => o.storeLogo !== null && o.storeLogo !== '')
	@IsUrl()
	storeLogo?: string;
}
