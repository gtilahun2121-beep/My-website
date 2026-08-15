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
import { AuctionController } from './auction.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { DebitTask } from './tasks/debit.task';

@Module({
    controllers: [PaymentsController, LotteryController, AuctionController],
    providers: [PaymentsService, PaymentsRepository, DebitTask],
    exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule { }
