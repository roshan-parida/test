import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
	@ApiProperty({
		example: 'user@example.com',
		description: 'User email address',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		example: '123456',
		description: '6-digit OTP code',
	})
	@IsString()
	@Length(6, 6, { message: 'OTP must be exactly 6 digits' })
	otp: string;

	@ApiProperty({
		example: 'newpassword123',
		description: 'New password (min 8 characters)',
	})
	@IsString()
	@MinLength(8)
	newPassword: string;
}
