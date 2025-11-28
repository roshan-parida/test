import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateUserRoleDto {
	@ApiProperty({
		enum: UserRole,
		example: UserRole.MANAGER,
		description: 'New user role',
	})
	@IsEnum(UserRole)
	role: UserRole;
}
