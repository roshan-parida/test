import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
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
}
