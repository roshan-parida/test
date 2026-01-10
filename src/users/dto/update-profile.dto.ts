import { IsString, IsOptional, IsUrl, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
	@ApiPropertyOptional({
		example: 'John Doe',
		description: 'Full name',
	})
	@IsString()
	@IsOptional()
	name?: string;

	@ApiPropertyOptional({
		example: '+911234567890',
		description: 'Phone number',
	})
	@IsString()
	@IsOptional()
	phone?: string;

	@ApiPropertyOptional({
		example: 'https://example.com/profile.jpg',
		description: 'Profile image URL',
	})
	@IsOptional()
	@ValidateIf((o) => o.profileImage !== null && o.profileImage !== '')
	@IsUrl()
	profileImage?: string;
}
