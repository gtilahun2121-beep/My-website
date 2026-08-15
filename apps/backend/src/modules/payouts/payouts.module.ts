/**
 * payouts.module.ts
 *
 * Wires together all disbursement providers:
 *  - PayoutsController   (REST endpoints)
 *  - PayoutsService      (state machine + provider orchestration)
 *  - PayoutsRepository   (Neon DB access)
 *  - PayoutTask          (scheduled cron disbursement)
 *  - PayoutProviderService (sandbox → live provider resolution)
 */

import { Module } from '@nestjs/common';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutsRepository } from './payouts.repository';
import { PayoutTask } from './tasks/payout.task';
import { PayoutProviderService } from './providers/payout-provider.service';
import { SandboxBankProvider } from './providers/sandbox-bank.provider';

@Module({
    controllers: [PayoutsController],
    providers: [
        PayoutsService,
        PayoutsRepository,
        PayoutTask,
        PayoutProviderService,
        SandboxBankProvider,
    ],
    exports: [PayoutsService, PayoutsRepository],
})
export class PayoutsModule { }