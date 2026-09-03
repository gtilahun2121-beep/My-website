/**
 * lottery-access.spec.ts
 *
 * End-to-end style authorization tests for the lottery HTTP layer using a
 * NestJS testing module + supertest. Covers the USER-FACING ACCESS contract:
 *
 *   POST /api/v1/equbs/:id/draws            → host/admin ONLY (403 for users)
 *   GET  /api/v1/equbs/:id/lottery/current  → any authenticated user
 *   GET  /api/v1/equbs/:id/lottery/history  → any authenticated user
 *   All protected endpoints                  → 401 when unauthenticated
 */

import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import request from 'supertest';

import { LotteryController } from './lottery.controller';
import { UserLotteryController } from './user-lottery.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.service';

/** Holds the "logged in" user for the current request, so tests can swap roles. */
const session: { user: JwtPayload | null } = { user: null };

/** Stand-in for the real passport JWT guard. When no user is set it behaves
 *  like an unauthenticated request (throws → 401); otherwise it attaches the
 *  session user to req.user exactly as the real JwtStrategy.validate() does. */
@Injectable()
class StubJwtAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        if (!session.user) {
            throw new UnauthorizedException('No authenticated user found.');
        }
        req.user = session.user;
        return true;
    }
}

function makeUser(role: JwtPayload['role'], sub = 'user-1'): JwtPayload {
    return {
        sub,
        phone: '0911000000',
        email: 'user@example.com',
        first_name: 'Dawit',
        last_name: 'Abera',
        role,
        trust_tier: 'standard',
        jti: 'jti-test',
    };
}

describe('Lottery access control (HTTP layer)', () => {
    let app: INestApplication;
    let paymentsService: { runLotteryDraw: jest.Mock; getLotteryCurrent: jest.Mock; getPublicLotteryHistory: jest.Mock };

    beforeAll(async () => {
        paymentsService = {
            runLotteryDraw: jest.fn().mockResolvedValue({ draw: { id: 'draw-1', winner_id: 'w' }, message: 'drawn' }),
            getLotteryCurrent: jest.fn().mockResolvedValue({ cycle: { number: 1 }, eligibility: {}, latestWinner: null }),
            getPublicLotteryHistory: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, total_pages: 0 }),
        };

        const moduleRef = await Test.createTestingModule({
            controllers: [LotteryController, UserLotteryController],
            providers: [{ provide: PaymentsService, useValue: paymentsService }],
        })
            .overrideGuard(JwtAuthGuard)
            .useClass(StubJwtAuthGuard)
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        session.user = null;
        jest.clearAllMocks();
    });

    describe('POST /api/v1/equbs/:id/draws (the spin)', () => {
        it('rejects a NORMAL (participant) user with 403 Forbidden', async () => {
            session.user = makeUser('participant');
            await request(app.getHttpServer())
                .post('/api/v1/equbs/equb-1/draws')
                .expect(403);
            expect(paymentsService.runLotteryDraw).not.toHaveBeenCalled();
        });

        it('allows an ADMIN to execute the lottery (201)', async () => {
            session.user = makeUser('admin');
            await request(app.getHttpServer())
                .post('/api/v1/equbs/equb-1/draws')
                .expect(201);
            expect(paymentsService.runLotteryDraw).toHaveBeenCalled();
        });

        it('allows a HOST to execute the lottery (201)', async () => {
            session.user = makeUser('host');
            await request(app.getHttpServer())
                .post('/api/v1/equbs/equb-1/draws')
                .expect(201);
            expect(paymentsService.runLotteryDraw).toHaveBeenCalled();
        });

        it('blocks an unauthenticated request with 401', async () => {
            session.user = null;
            await request(app.getHttpServer())
                .post('/api/v1/equbs/equb-1/draws')
                .expect(401);
            expect(paymentsService.runLotteryDraw).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/v1/equbs/:id/lottery/current', () => {
        it('allows any authenticated user', async () => {
            session.user = makeUser('participant');
            await request(app.getHttpServer())
                .get('/api/v1/equbs/equb-1/lottery/current')
                .expect(200);
            expect(paymentsService.getLotteryCurrent).toHaveBeenCalledWith('equb-1', 'user-1');
        });

        it('blocks an unauthenticated request with 401', async () => {
            session.user = null;
            await request(app.getHttpServer())
                .get('/api/v1/equbs/equb-1/lottery/current')
                .expect(401);
            expect(paymentsService.getLotteryCurrent).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/v1/equbs/:id/lottery/history', () => {
        it('allows any authenticated user with pagination', async () => {
            session.user = makeUser('participant');
            await request(app.getHttpServer())
                .get('/api/v1/equbs/equb-1/lottery/history?page=2&limit=5')
                .expect(200);
            expect(paymentsService.getPublicLotteryHistory).toHaveBeenCalledWith('equb-1', 2, 5);
        });

        it('blocks an unauthenticated request with 401', async () => {
            session.user = null;
            await request(app.getHttpServer())
                .get('/api/v1/equbs/equb-1/lottery/history')
                .expect(401);
            expect(paymentsService.getPublicLotteryHistory).not.toHaveBeenCalled();
        });
    });
});
