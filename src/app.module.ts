import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OAuthModule } from './oauth/oauth.module';
import { UsersModule } from './users/users.module';
import { StoresModule } from './stores/stores.module';
import { MetricsModule } from './metrics/metrics.module';
import { JobsModule } from './jobs/jobs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailModule } from './mail/mail.module';
import { FacebookAnalyticsModule } from './integrations/facebook/facebook-analytics.module';
import { AuditModule } from './audit/audit.module';
import { DocsModule } from './docs/docs.module';
import { PredictionsModule } from './predictions/predictions.module';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		MongooseModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				uri: config.get<string>('MONGODB_URI'),
			}),
		}),
		ScheduleModule.forRoot(),
		AuthModule,
		OAuthModule,
		UsersModule,
		StoresModule,
		MetricsModule,
		JobsModule,
		AnalyticsModule,
		MailModule,
		FacebookAnalyticsModule,
		AuditModule,
		DocsModule,
		PredictionsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
