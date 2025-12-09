import {
	IsEmail,
	IsArray,
	IsMongoId,
	IsNotEmpty,
	IsString,
	IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums/user-role.enum';

export class InviteViewerDto {
	@ApiProperty({
		example: 'viewer@example.com',
		description: 'Email of the viewer to invite',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description: 'Array of store IDs to assign',
		example: ['507f1f77bcf86cd799439011'],
		type: [String],
	})
	@IsArray()
	@IsMongoId({ each: true })
	storeIds: string[];

	@IsEnum(UserRole, { message: 'Role must be VIEWER' })
	role: UserRole = UserRole.VIEWER;
}
