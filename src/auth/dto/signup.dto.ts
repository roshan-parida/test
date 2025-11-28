import {
	IsEmail,
	IsString,
	MinLength,
	IsEnum,
	IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class SignupDto {
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

	@ApiPropertyOptional({
		enum: UserRole,
		example: UserRole.VIEWER,
		description: 'User role',
	})
	@IsOptional()
	@IsEnum(UserRole)
	role?: UserRole;
}
