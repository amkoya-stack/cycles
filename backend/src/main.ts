/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { RedisService } from './cache/redis.service';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });

  // Increase body size limit to 10MB
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global idempotency interceptor
  const redisService = app.get(RedisService);
  app.useGlobalInterceptors(new IdempotencyInterceptor(redisService));

  // Global HTTP metrics interceptor
  const httpMetricsInterceptor = app.get(HttpMetricsInterceptor);
  app.useGlobalInterceptors(httpMetricsInterceptor);

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // Serve static files (uploads) - before API prefix to avoid /api prefix
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));
  console.log(`📁 Serving static files from: ${uploadDir}`);

  // API prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  const port = process.env.PORT || 4000;
  // Bind to localhost to avoid Windows EACCES on 0.0.0.0
  await app.listen(port, '127.0.0.1');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();
