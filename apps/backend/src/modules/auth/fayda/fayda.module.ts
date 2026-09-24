/**
 * fayda.module.ts
 * Provides FaydaService for real Fayda (eSignet) OIDC + OTP verification.
 */

import { Module } from '@nestjs/common';
import { FaydaService } from './fayda.service';

@Module({
    providers: [FaydaService],
    exports: [FaydaService],
})
export class FaydaModule { }