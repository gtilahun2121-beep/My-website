/**
 * main.ts
 *
 * NestJS application bootstrap.
 * Initialisation order matters:
 *  1. Load secrets from VaultConfig (AWS or .env)
 *  2. Initialise Neon connection pool
 *  3. Create NestJS app
 *  4. Apply global middleware, pipes, and interceptors
 *  5. Listen
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env before anything else — ensures process.env is populated
// even when turbo invokes the process from the monorepo root.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../apps/backend/.env') });
dotenv.config(); // fallback: .env in current working directory

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { VaultConfig } from './config/vault.config';
import { initDatabase, closeDatabase } from './config/database.config';

async function bootstrap() {
    // ── 1. Secrets ────────────────────────────────────────────────────────────
    await VaultConfig.load();

    // ── 2. Database ───────────────────────────────────────────────────────────
    await initDatabase();

    // ── 3. NestJS App ─────────────────────────────────────────────────────────
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'error', 'warn', 'debug'],
    });

    // ── 4. Global Middleware & Pipes ──────────────────────────────────────────

    // Parse cookies — needed for HttpOnly refresh token
    app.use(cookieParser());

    // Global validation pipe — strips unknown fields, enforces DTOs
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS — restrict to trusted origins in production
    app.enableCors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
        credentials: true,
    });

    // ── 5. Swagger (dev only) ─────────────────────────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('QalNet API')
            .setDescription('QalNet Enterprise Digital Equb Platform — Backend API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
        console.log('[Bootstrap] Swagger UI available at /api/docs');
    }

    // ── 6. Graceful Shutdown ──────────────────────────────────────────────────
    app.enableShutdownHooks();

    process.on('SIGTERM', async () => {
        console.log('[Bootstrap] SIGTERM received — shutting down gracefully.');
        await app.close();
        await closeDatabase();
        process.exit(0);
    });

    // ── 7. Listen ─────────────────────────────────────────────────────────────
    const port = parseInt(process.env.PORT ?? '3000', 10);
    await app.listen(port);
    console.log(`[Bootstrap] QalNet API running on port ${port}`);
}

bootstrap().catch((err) => {
    console.error('[Bootstrap] Fatal startup error:', err);
    process.exit(1);
});
