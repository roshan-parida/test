import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInvitationDto {
	@ApiProperty({
		example: 'John Doe',
		description: 'Full name',
	})
	@IsString()
	name: string;

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
		description: 'Profile image URL (optional)',
		required: false,
	})
	@IsUrl()
	@IsOptional()
	profileImage?: string;
}
