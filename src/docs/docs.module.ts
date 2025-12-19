import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { Docs, DocsSchema } from './schemas/docs.schema';
import { AuditModule } from '../audit/audit.module';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: Docs.name, schema: DocsSchema }]),
		AuditModule,
	],
	controllers: [DocsController],
	providers: [DocsService],
	exports: [DocsService],
})
export class DocsModule {}
