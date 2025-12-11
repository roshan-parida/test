import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PendingUser, PendingUserSchema } from './schemas/pending-user.schema';
import {
	PasswordReset,
	PasswordResetSchema,
} from './schemas/password-reset.schema';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [
		ConfigModule,
		UsersModule,
		MailModule,
		AuditModule,
		MongooseModule.forFeature([
			{ name: PendingUser.name, schema: PendingUserSchema },
			{ name: PasswordReset.name, schema: PasswordResetSchema },
		]),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.getOrThrow<string>('JWT_SECRET'),
				signOptions: {
					expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
						'24h') as any,
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy],
	exports: [AuthService],
})
export class AuthModule {}
