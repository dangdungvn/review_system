import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOriginConfig = process.env.CORS_ORIGIN?.trim();
  const corsOrigin =
    !corsOriginConfig || corsOriginConfig === '*'
      ? true
      : corsOriginConfig
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'Origin',
      'X-Requested-With',
      'ngrok-skip-browser-warning',
    ],
    credentials: true, // Cho phép gửi cookies
    optionsSuccessStatus: 204,
  });

  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ limit: '8mb', extended: true }));

  // Enable cookie parser
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger configuration với Bearer authentication
  const config = new DocumentBuilder()
    .setTitle('Review System API')
    .setDescription('PDF → Đề thi trắc nghiệm, Flashcards, Câu hỏi Đúng/Sai')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập JWT token để xác thực',
        in: 'header',
      },
      'JWT',
    )
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
      description: 'Cookie authentication cho web',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Lưu auth vào localStorage
      withCredentials: true, // Tự động gửi cookies
    },
    customJs: '/swagger-custom.js', // Custom JS để auto-authorize
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
