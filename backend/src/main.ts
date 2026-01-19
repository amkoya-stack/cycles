/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-call */

console.log('🟢 main.ts file loaded - starting imports...');

// Import polyfills first (must be before any other imports)
import './polyfills';
console.log('✅ Polyfills imported');

import { NestFactory } from '@nestjs/core';
console.log('✅ NestFactory imported');
import { ValidationPipe, VersioningType } from '@nestjs/common';
console.log('✅ Common modules imported');
import { AppModule } from './app.module';
console.log('✅ AppModule imported');
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
console.log('✅ Interceptors imported');
import { RedisService } from './cache/redis.service';
console.log('✅ RedisService imported');
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
console.log('✅ All imports completed');

async function bootstrap() {
  try {
    console.log('🔵 Starting application bootstrap...');
    const app = await NestFactory.create(AppModule, {
      bodyParser: true,
      rawBody: false,
    });
    console.log('✅ NestJS application created successfully');

    // Increase body size limit to 10MB
    app.use(require('express').json({ limit: '10mb' }));
    app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

    // Enable CORS for multiple origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL,
      'https://frontend-eight-lilac-72.vercel.app',
      'https://frontend-eduvcggx9-amkoyastacks-projects.vercel.app',
    ].filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin matches allowed origins or is a Vercel preview
        if (allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
          return callback(null, true);
        }

        callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
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
    const uploadDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadDir));
    console.log(`📁 Serving static files from: ${uploadDir}`);

    // API prefix
    app.setGlobalPrefix(process.env.API_PREFIX || 'api');

    // Add health endpoint
    app.use('/health', (req, res) => {
      res
        .status(200)
        .json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const port = process.env.PORT || 3001;
    // In production, bind to 0.0.0.0 for Railway
    const host =
      process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    await app.listen(port, host);
    console.log(`🚀 Application is running on: http://${host}:${port}`);
  } catch (error) {
    console.error('❌ Fatal error during bootstrap:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}
bootstrap().catch((error) => {
  console.error('❌ Unhandled error in bootstrap:', error);
  process.exit(1);
});
