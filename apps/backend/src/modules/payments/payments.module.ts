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
import { MultiMethodPaymentController } from './multi-method-payment.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { DebitTask } from './tasks/debit.task';
import { PaymentProviderService } from './providers/payment-provider.service';
import { ChapaPaymentProvider } from './providers/chapa.provider';
import { TelebirrPaymentProvider } from './providers/telebirr.provider';
import { SandboxPaymentProvider } from './providers/sandbox.provider';
import { DashenBankProvider } from './providers/dashen-bank.provider';
import { WalletTransferProvider } from './providers/wallet-transfer.provider';
import { MultiMethodPaymentService } from './services/multi-method-payment.service';

@Module({
    controllers: [
        PaymentsController,
        LotteryController,
        UserLotteryController,
        AuctionController,
        MultiMethodPaymentController,
    ],
    providers: [
        PaymentsService,
        PaymentsRepository,
        DebitTask,
        PaymentProviderService,
        ChapaPaymentProvider,
        TelebirrPaymentProvider,
        SandboxPaymentProvider,
        DashenBankProvider,
        WalletTransferProvider,
        MultiMethodPaymentService,
    ],
    exports: [PaymentsService, PaymentsRepository, PaymentProviderService, MultiMethodPaymentService],
})
export class PaymentsModule { }
