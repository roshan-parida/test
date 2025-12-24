import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { StoresModule } from '../stores/stores.module';
import { AuditModule } from '../audit/audit.module';

@Module({
	imports: [
		HttpModule.register({
			timeout: 30000, // 30 second timeout for ML operations
			maxRedirects: 5,
		}),
		ConfigModule,
		StoresModule,
		AuditModule,
	],
	controllers: [PredictionsController],
	providers: [PredictionsService],
	exports: [PredictionsService],
})
export class PredictionsModule {}
