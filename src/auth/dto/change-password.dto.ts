import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
	@ApiProperty({
		example: 'currentpassword123',
		description: 'Current password',
	})
	@IsString()
	currentPassword: string;

	@ApiProperty({
		example: 'newpassword123',
		description: 'New password (min 8 characters)',
	})
	@IsString()
	@MinLength(8)
	newPassword: string;
}
