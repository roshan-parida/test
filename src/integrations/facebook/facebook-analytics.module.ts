import { Module, forwardRef } from '@nestjs/common';
import { FacebookAnalyticsController } from './facebook-analytics.controller';
import { FacebookService } from './facebook.service';
import { StoresModule } from '../../stores/stores.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [forwardRef(() => StoresModule), AuditModule],
	controllers: [FacebookAnalyticsController],
	providers: [FacebookService],
	exports: [FacebookService],
})
export class FacebookAnalyticsModule {}
