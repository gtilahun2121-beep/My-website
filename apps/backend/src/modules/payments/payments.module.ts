/**
 * payments.module.ts
 *
 * Wires together all payments-related providers:
 *  - PaymentsController  (REST endpoints)
 *  - PaymentsService     (business logic)
 *  - PaymentsRepository  (Neon DB access)
 *  - DebitTask           (scheduled cron auto-debit)
 */

import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { LotteryController } from './lottery.controller';
import { UserLotteryController } from './user-lottery.controller';
import { AuctionController } from './auction.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { DebitTask } from './tasks/debit.task';
import { PaymentProviderService } from './providers/payment-provider.service';
import { ChapaPaymentProvider } from './providers/chapa.provider';
import { TelebirrPaymentProvider } from './providers/telebirr.provider';
import { SandboxPaymentProvider } from './providers/sandbox.provider';

@Module({
    controllers: [PaymentsController, LotteryController, UserLotteryController, AuctionController],
    providers: [
        PaymentsService,
        PaymentsRepository,
        DebitTask,
        PaymentProviderService,
        ChapaPaymentProvider,
        TelebirrPaymentProvider,
        SandboxPaymentProvider,
    ],
    exports: [PaymentsService, PaymentsRepository, PaymentProviderService],
})
export class PaymentsModule { }
