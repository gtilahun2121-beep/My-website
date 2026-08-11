/**
 * sms.module.ts
 *
 * Provides SmsService for SMS delivery (currently AfricasTalking).
 */

import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';

@Module({
    providers: [SmsService],
    exports: [SmsService],
})
export class SmsModule { }
