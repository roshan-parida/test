import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
	process.env.TZ = 'Asia/Kolkata';
	const app = await NestFactory.create(AppModule);

	app.setGlobalPrefix('api', {
		exclude: [
			{ path: '/', method: RequestMethod.GET },
			{ path: '/health', method: RequestMethod.GET },
		],
	});

	const config = new DocumentBuilder()
		.setTitle('Ad Matrix Backend API')
		.setDescription('API documentation for the Ad Matrix Backend')
		.setVersion('0.1.0')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				description: 'Enter JWT token from /auth/login',
			},
			'JWT-auth',
		)
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('api/docs', app, document, {
		swaggerOptions: { persistAuthorization: true },
	});

	app.enableCors({
		origin: ['http://localhost:3000', process.env.FRONTEND_URL].filter(
			Boolean,
		),
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
		}),
	);

	const port = parseInt(process.env.PORT || '10000');
	await app.listen(port, '0.0.0.0');

	console.log(`🚀 Backend running on port ${port}`);
}
bootstrap().catch((err) => {
	console.error('Failed to start application:', err);
	process.exit(1);
});
