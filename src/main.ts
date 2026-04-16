import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');

  // === Security hardening theo CLAUDE.md ===

  // Helmet: HSTS, CSP — dynamic import để tương thích module: nodenext
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helmet = require('helmet') as typeof import('helmet');
  const helmetFn = typeof helmet === 'function' ? helmet : (helmet as any).default;
  app.use(
    helmetFn({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // CORS: explicit origins, không dùng '*'
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cookie parser
  app.use(cookieParser());

  // ValidationPipe: whitelist + forbidNonWhitelisted theo CLAUDE.md
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptor: wrap successful response trong { statusCode, data, timestamp }
  app.useGlobalInterceptors(new TransformInterceptor());

  // === Swagger - chỉ bật trong development ===
  if (!isProduction) {
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
        persistAuthorization: true,
        withCredentials: true,
      },
      customJs: '/swagger-custom.js',
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  if (!isProduction) {
    console.log(`Application running on: http://localhost:${port}`);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
