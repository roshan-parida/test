import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId } from 'class-validator';

export class AssignStoresDto {
	@ApiProperty({
		description: 'Array of store IDs to assign',
		example: ['507f1f77bcf86cd799439011'],
		type: [String],
	})
	@IsArray()
	@IsMongoId({ each: true })
	storeIds: string[];
}
