# Lottery Selection Service - Implementation Guide

## Table of Contents
1. [Setup Instructions](#setup-instructions)
2. [Integration Guide](#integration-guide)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Configuration](#configuration)
6. [Deployment Checklist](#deployment-checklist)

---

## Setup Instructions

### 1. Prerequisites
```bash
# Ensure these packages are installed in your project:
npm install @nestjs/common @nestjs/core typeorm class-validator class-transformer
```

### 2. Module Registration

In your `payouts.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotterySelectionService } from './services/lottery-selection.service';
import { PayoutsController } from './payouts.controller';

// Import your entities
import { PayoutCycle } from './entities/payout-cycle.entity';
import { MemberEligibilityStatus } from './entities/member-eligibility-status.entity';
import { WinnerSelection } from './entities/winner-selection.entity';
import { PayoutHistory } from './entities/payout-history.entity';
import { PaymentReminder } from './entities/payment-reminder.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayoutCycle,
      MemberEligibilityStatus,
      WinnerSelection,
      PayoutHistory,
      PaymentReminder,
      AuditLog,
    ]),
  ],
  providers: [LotterySelectionService],
  controllers: [PayoutsController],
  exports: [LotterySelectionService], // If other modules need this service
})
export class PayoutsModule {}
```

### 3. Service Injection

In your `payouts.controller.ts`:

```typescript
import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { LotterySelectionService } from './services/lottery-selection.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('equbs')
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly lotteryService: LotterySelectionService) {}

  @Post(':equbId/cycles/:cycleId/select-winner-lottery')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async selectLotteryWinner(
    @Param('equbId') equbId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.selectWinnerForCycle(equbId, cycleId);
  }

  @Get(':equbId/cycles/:cycleId/eligible-members')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async getEligibleMembers(
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.getEligibleMembers(cycleId);
  }

  @Get(':equbId/cycles/:cycleId/validate-draw')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async validateDraw(
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.validateDrawConditions(cycleId);
  }

  @Get(':equbId/cycles/:cycleId/verify-reproducibility/:seed')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async verifyReproducibility(
    @Param('cycleId') cycleId: string,
    @Param('seed') seed: string,
  ) {
    return this.lotteryService.verifyReproducibility(cycleId, seed);
  }
}
```

---

## Integration Guide

### Step 1: Update Service Initialization

The service requires repository injection. Update the service constructor in your dependency injection container:

```typescript
// In your payouts.module.ts or a dedicated factory
providers: [
  {
    provide: LotterySelectionService,
    useFactory: (
      dataSource: DataSource,
      payoutCycleRepository: Repository<PayoutCycle>,
      memberEligibilityRepository: Repository<MemberEligibilityStatus>,
      winnerSelectionRepository: Repository<WinnerSelection>,
      payoutHistoryRepository: Repository<PayoutHistory>,
      paymentReminderRepository: Repository<PaymentReminder>,
      auditLogRepository: Repository<AuditLog>,
    ) => {
      return new LotterySelectionService(dataSource, {
        payoutCycleRepository,
        memberEligibilityRepository,
        winnerSelectionRepository,
        payoutHistoryRepository,
        paymentReminderRepository,
        auditLogRepository,
      });
    },
    inject: [
      DataSource,
      getRepositoryToken(PayoutCycle),
      getRepositoryToken(MemberEligibilityStatus),
      getRepositoryToken(WinnerSelection),
      getRepositoryToken(PayoutHistory),
      getRepositoryToken(PaymentReminder),
      getRepositoryToken(AuditLog),
    ],
  },
],
```

### Step 2: Error Handling

Add global error handling in your exception filter:

```typescript
// exceptions/database-error.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';

@Catch(InternalServerErrorException)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(exception: InternalServerErrorException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(500).json({
      statusCode: 500,
      message: 'Database operation failed',
      timestamp: new Date().toISOString(),
    });
  }
}
```

Register in `main.ts`:
```typescript
app.useGlobalFilters(new DatabaseErrorFilter());
```

### Step 3: Request/Response Validation

Use DTOs for type safety:

```typescript
import { InitiateLotteryDrawDto } from './dto/lottery.dto';

@Post('draw')
async draw(@Body() dto: InitiateLotteryDrawDto) {
  return this.lotteryService.selectWinnerForCycle(dto.equbId, dto.cycleId);
}
```

---

## Database Schema

### Required Tables

#### 1. `payout_cycles` table
```sql
CREATE TABLE payout_cycles (
  cycle_id UUID PRIMARY KEY,
  equb_id UUID NOT NULL REFERENCES equbs(id),
  cycle_number INT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'DRAWING', 'COMPLETED', 'CANCELLED')),
  pot_amount DECIMAL(10, 2) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  selected_winner_id UUID REFERENCES members(id),
  total_members INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_cycle_per_equb UNIQUE(equb_id, cycle_number),
  INDEX idx_equb_status (equb_id, status),
  INDEX idx_winner (selected_winner_id)
);
```

#### 2. `member_eligibility_status` table
```sql
CREATE TABLE member_eligibility_status (
  eligibility_id UUID PRIMARY KEY,
  payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(cycle_id),
  member_id UUID NOT NULL REFERENCES members(id),
  has_paid_contribution BOOLEAN DEFAULT FALSE,
  is_past_winner BOOLEAN DEFAULT FALSE,
  has_opted_out BOOLEAN DEFAULT FALSE,
  is_active_member BOOLEAN DEFAULT TRUE,
  last_payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_member_per_cycle UNIQUE(payout_cycle_id, member_id),
  INDEX idx_cycle_eligible (payout_cycle_id, has_paid_contribution, is_past_winner, has_opted_out),
  INDEX idx_member_status (member_id, is_past_winner)
);
```

#### 3. `winner_selections` table
```sql
CREATE TABLE winner_selections (
  selection_id UUID PRIMARY KEY,
  payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(cycle_id),
  winner_id UUID NOT NULL REFERENCES members(id),
  selection_method VARCHAR(20) NOT NULL CHECK (selection_method IN ('LOTTERY', 'MANUAL', 'ROTATION')),
  selected_at TIMESTAMP NOT NULL,
  prng_seed VARCHAR(64) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_cycle_selection (payout_cycle_id),
  INDEX idx_winner_selections (winner_id)
);
```

#### 4. `payout_history` table
```sql
CREATE TABLE payout_history (
  history_id UUID PRIMARY KEY,
  payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(cycle_id),
  member_id UUID NOT NULL REFERENCES members(id),
  payout_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_member_payout (member_id, status),
  INDEX idx_cycle_payout (payout_cycle_id, status)
);
```

#### 5. `payment_reminders` table
```sql
CREATE TABLE payment_reminders (
  reminder_id UUID PRIMARY KEY,
  winner_id UUID NOT NULL REFERENCES members(id),
  payout_cycle_id UUID NOT NULL REFERENCES payout_cycles(cycle_id),
  reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN ('PAYOUT_READY', 'PAYOUT_REMINDER', 'PAYOUT_OVERDUE')),
  sent_at TIMESTAMP NOT NULL,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_winner_reminders (winner_id, reminder_type),
  INDEX idx_cycle_reminders (payout_cycle_id)
);
```

#### 6. `audit_logs` table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  cycle_id UUID REFERENCES payout_cycles(cycle_id),
  equb_id UUID REFERENCES equbs(id),
  performed_by VARCHAR(100) NOT NULL,
  member_count INT,
  winner_id UUID REFERENCES members(id),
  details JSONB,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp),
  INDEX idx_cycle_audit (cycle_id)
);
```

### TypeORM Entities

Create corresponding entities:

```typescript
// entities/payout-cycle.entity.ts
import { Entity, PrimaryColumn, Column, Index, ManyToOne, JoinColumn } from 'typeorm';

@Entity('payout_cycles')
@Index(['equb_id', 'status'])
@Index(['selected_winner_id'])
export class PayoutCycle {
  @PrimaryColumn('uuid')
  cycle_id: string;

  @Column('uuid')
  equb_id: string;

  @Column('int')
  cycle_number: number;

  @Column('varchar', { length: 20 })
  status: 'OPEN' | 'DRAWING' | 'COMPLETED' | 'CANCELLED';

  @Column('decimal', { precision: 10, scale: 2 })
  pot_amount: number;

  @Column('timestamp')
  start_date: Date;

  @Column('timestamp')
  end_date: Date;

  @Column('uuid', { nullable: true })
  selected_winner_id: string;

  @Column('int')
  total_members: number;

  @Column('timestamp', { default: () => 'NOW()' })
  created_at: Date;

  @Column('timestamp', { default: () => 'NOW()' })
  updated_at: Date;
}
```

---

## API Endpoints

### 1. Select Winner (Lottery)
```http
POST /equbs/{equbId}/cycles/{cycleId}/select-winner-lottery
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "success": true,
  "payoutCycleId": "cycle-1",
  "winnerId": "member-25",
  "winnerName": "John Doe",
  "winnerPhone": "+251911111111",
  "potAmount": 5000,
  "electedAt": "2024-01-15T10:30:45.123Z",
  "totalEligibleMembers": 50,
  "prngSeed": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "message": "John Doe has been selected as the winner for this cycle!"
}
```

### 2. Get Eligible Members
```http
GET /equbs/{equbId}/cycles/{cycleId}/eligible-members
Authorization: Bearer {token}
```

**Response (200):**
```json
[
  {
    "member_id": "member-1",
    "member_name": "Alice Smith",
    "member_phone": "+251922222222",
    "has_paid_contribution": true,
    "is_past_winner": false,
    "has_opted_out": false,
    "is_active_member": true
  },
  ...
]
```

### 3. Validate Draw Conditions
```http
GET /equbs/{equbId}/cycles/{cycleId}/validate-draw
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "valid": true,
  "errors": [],
  "eligibleMemberCount": 50,
  "cycleStatus": "OPEN"
}
```

### 4. Verify Reproducibility
```http
GET /equbs/{equbId}/cycles/{cycleId}/verify-reproducibility/{seed}
Authorization: Bearer {token}
```

**Response (200):**
```json
{
  "expectedWinnerId": "member-25",
  "isValid": true,
  "message": "Seed verification successful"
}
```

---

## Configuration

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=qalnet
DB_PASSWORD=secure_password
DB_NAME=qalnet_db

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Timezone
TZ=Africa/Addis_Ababa
```

### NestJS Configuration

In `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: false,
      logging: process.env.LOG_LEVEL === 'debug',
    }),
  ],
})
export class AppModule {}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] Code reviewed and approved
- [ ] Database migrations created and tested
- [ ] Security review completed (input validation, auth guards)
- [ ] Performance testing completed (large member lists)
- [ ] Error handling tested
- [ ] Audit logging verified
- [ ] Documentation updated

### Deployment Steps

1. **Backup Database**
   ```bash
   # Backup production database
   pg_dump -U qalnet qalnet_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   npm run typeorm migration:run
   ```

3. **Deploy Service**
   ```bash
   npm run build
   npm run start:prod
   ```

4. **Health Check**
   ```bash
   # Verify service is running
   curl -X GET http://localhost:3000/health
   ```

5. **Test Endpoint**
   ```bash
   # Test lottery selection with test data
   curl -X POST http://localhost:3000/equbs/test-equb/cycles/test-cycle/select-winner-lottery
   ```

### Post-Deployment

- [ ] Monitor logs for errors
- [ ] Check database performance
- [ ] Verify audit logs are being created
- [ ] Monitor error rates
- [ ] Confirm email/SMS notifications are working
- [ ] Test rollback procedure

### Rollback Plan

If deployment fails:

1. **Stop the service**
   ```bash
   pm2 stop app
   ```

2. **Revert code**
   ```bash
   git revert <commit-hash>
   npm run build
   ```

3. **Restore database**
   ```bash
   psql -U qalnet qalnet_db < backup_file.sql
   ```

4. **Restart service**
   ```bash
   pm2 start app
   ```

---

## Performance Tuning

### Database Indexes

Ensure these indexes exist:

```sql
-- Critical indexes for query performance
CREATE INDEX idx_member_eligibility_search 
  ON member_eligibility_status(payout_cycle_id, has_paid_contribution, is_past_winner, has_opted_out);

CREATE INDEX idx_payout_cycle_status 
  ON payout_cycles(equb_id, status);

CREATE INDEX idx_audit_log_timestamp 
  ON audit_logs(timestamp DESC);
```

### Connection Pooling

Configure in `app.module.ts`:

```typescript
TypeOrmModule.forRoot({
  // ... other config
  pool: {
    min: 5,
    max: 20,
  },
})
```

### Query Optimization

- Use `QueryRunner` with read replicas for heavy loads
- Implement caching for eligible member lists
- Use batch operations where possible

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Selection Operation Duration**: Target < 100ms
2. **Transaction Success Rate**: Target > 99.9%
3. **Eligible Member Query Duration**: Target < 50ms
4. **Database Error Rate**: Target < 0.1%
5. **Audit Log Write Success**: Target > 99%

### Example Monitoring Query

```sql
-- Check selection operation performance
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as total,
  COUNT(CASE WHEN action = 'WINNER_SELECTED' THEN 1 END) as successes,
  COUNT(CASE WHEN action = 'WINNER_SELECTED' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM audit_logs
WHERE action IN ('WINNER_SELECTED')
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;
```

---

## Support & Maintenance

### Common Issues & Solutions

**Issue: "No eligible members found"**
- Check member contribution status
- Verify opt-out preferences

**Issue: "Transaction timeout"**
- Increase connection pool size
- Check database performance
- Verify no deadlocks

**Issue: "Permission denied"**
- Verify JWT token validity
- Check user roles
- Ensure admin access

### Regular Maintenance

- Weekly: Check audit logs for anomalies
- Monthly: Run VACUUM/ANALYZE on database
- Quarterly: Review and archive old audit logs
- Annually: Load testing and capacity planning

---

## References

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Node.js Crypto](https://nodejs.org/api/crypto.html)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

