import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { StoresModule } from '../stores/stores.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
	imports: [
		ConfigModule,
		HttpModule.register({
			timeout: 10000,
			maxRedirects: 5,
		}),
		StoresModule,
		UsersModule,
		AuditModule,
	],
	controllers: [OAuthController],
	providers: [OAuthService],
	exports: [OAuthService],
})
export class OAuthModule {}
