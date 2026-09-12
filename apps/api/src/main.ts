import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { createRateLimiter } from './common/rate-limit.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(createRateLimiter({ windowMs: 60_000, max: 300 }));
  app.use(
    '/api/auth/login',
    createRateLimiter({
      windowMs: 60_000,
      max: 10,
      message: 'Muitas tentativas de login. Aguarde um minuto.',
    }),
  );
  app.use(
    '/api/auth/register',
    createRateLimiter({
      windowMs: 60_000,
      max: 5,
      message: 'Muitas tentativas de cadastro. Aguarde um minuto.',
    }),
  );
  app.use(
    '/api/auth/refresh',
    createRateLimiter({ windowMs: 60_000, max: 30 }),
  );

  app.setGlobalPrefix('api');

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:5173,http://tauri.localhost,tauri://localhost'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const isProduction = process.env.NODE_ENV === 'production';
  const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Sistema PDV — API')
      .setDescription(
        'API do Sistema PDV (multi-tenant). Rotas autenticadas exigem o header ' +
          '`Authorization: Bearer <accessToken>` obtido em `/api/auth/login`.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
