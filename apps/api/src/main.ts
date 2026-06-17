import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { raw } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // rawBody is required so the Stripe webhook can verify its signature.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Dev-media uploads receive raw image bytes (same as S3 PUT).
  app.use('/api/v1/dev-media', raw({ type: '*/*', limit: '12mb' }));

  const configuredOrigins = (config.get<string>('API_CORS_ORIGIN') ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigins = new Set(configuredOrigins);
  // Common local dev hosts for the web app.
  corsOrigins.add('http://localhost:3000');
  corsOrigins.add('http://127.0.0.1:3000');

  app.enableCors({
    origin: [...corsOrigins],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(config.get('API_PORT') ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
