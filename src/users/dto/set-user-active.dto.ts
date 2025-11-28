import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserActiveDto {
	@ApiProperty({ example: true, description: 'User active status' })
	@IsBoolean()
	isActive: boolean;
}
