import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Store, StoreSchema } from './schemas/store.schema';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: Store.name, schema: StoreSchema }]),
		forwardRef(() => MetricsModule),
		forwardRef(() => UsersModule),
		AuditModule,
	],
	providers: [StoresService],
	controllers: [StoresController],
	exports: [StoresService],
})
export class StoresModule {}
