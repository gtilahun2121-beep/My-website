/**
 * app.module.ts
 *
 * Root NestJS module. Registers all feature modules.
 */

import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SocialModule } from './modules/social/social.module';
import { UsersModule } from './modules/users/users.module';
import { EqubsModule } from './modules/equbs/equbs.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // __dirname resolves to apps/backend/src (or dist/src after build).
            // Going up two levels lands at apps/backend/ where .env lives.
            // This ensures the correct .env is loaded regardless of which
            // directory turbo/npm invokes the process from.
            envFilePath: [
                path.resolve(__dirname, '../../.env'),
                path.resolve(__dirname, '../../../apps/backend/.env'),
                '.env',
            ],
        }),
        ScheduleModule.forRoot(),
        AuthModule,
        PaymentsModule,
        SocialModule,
        UsersModule,
        EqubsModule,
        WalletModule,
        NotificationsModule,
    ],
})
export class AppModule { }
