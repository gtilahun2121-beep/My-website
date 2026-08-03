/**
 * app.module.ts
 *
 * Root NestJS module. Registers all feature modules.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
    imports: [
        // Load .env for local development (no-op in production where Vault is used)
        ConfigModule.forRoot({ isGlobal: true }),

        // Enable @Cron / @Interval decorators for the debit task
        ScheduleModule.forRoot(),

        // Feature modules
        AuthModule,
        PaymentsModule,
        // SocialModule — Milestone 5
    ],
})
export class AppModule { }
