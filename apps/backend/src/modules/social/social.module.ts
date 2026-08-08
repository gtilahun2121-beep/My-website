/**
 * social.module.ts
 *
 * Wires together all social module providers:
 *  - SocialController  (REST endpoints — proposals, votes, tickets, CRB)
 *  - SocialService     (business logic)
 *  - SocialRepository  (Neon DB access)
 */

import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialRepository } from './social.repository';

@Module({
    controllers: [SocialController],
    providers: [SocialService, SocialRepository],
    exports: [SocialService, SocialRepository],
})
export class SocialModule { }
