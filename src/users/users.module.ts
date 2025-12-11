import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { StoresModule } from '../stores/stores.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: User.name, schema: UserSchema },
			{ name: Invitation.name, schema: InvitationSchema },
		]),
		StoresModule,
		MailModule,
		AuditModule,
	],
	providers: [UsersService],
	controllers: [UsersController],
	exports: [UsersService],
})
export class UsersModule {}
