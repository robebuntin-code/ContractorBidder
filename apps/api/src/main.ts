import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, raw, urlencoded, type Request } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  // rawBody is required so the Stripe webhook can verify its signature.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, bodyParser: false });
  const config = app.get(ConfigService);

  // React Native fetch sends Content-Type with charset=UTF-8; body-parser only accepts utf-8.
  app.use((req, _res, next) => {
    const contentType = req.headers['content-type'];
    if (typeof contentType === 'string') {
      req.headers['content-type'] = contentType.replace(/charset=UTF-8/gi, 'charset=utf-8');
    }
    next();
  });

  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true }));

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

  const port = Number(process.env.PORT ?? config.get('API_PORT') ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
