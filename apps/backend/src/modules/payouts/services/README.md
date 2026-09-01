# Lottery Selection Service

## Overview

The `LotterySelectionService` implements a cryptographically secure random winner selection system for equb (savings group) payout cycles. It uses PRNG-based randomization with atomic database transactions to ensure fair, verifiable, and tamper-proof winner selection.

## Features

### Core Functionality
- **Cryptographic Random Selection**: Uses `crypto.randomBytes()` for true randomness (NOT `Math.random()`)
- **Eligibility Filtering**: Automatically filters members based on contribution status, past winner status, and opt-out preferences
- **Atomic Transactions**: All operations are wrapped in database transactions for data consistency
- **Audit Trails**: Comprehensive logging of all selections and operations
- **Reproducibility**: Deterministic selection using stored PRNG seeds for verification
- **Error Recovery**: Robust error handling with transaction rollback on failure

### Security Features
- Cryptographic randomness for unpredictability
- Race condition prevention through atomic transactions
- Audit logging for transparency
- Input validation and sanitization
- Admin-only access controls (via Guard in controller)

### Validation Checks
- Cycle existence and status verification
- Member eligibility verification
- Duplicate winner prevention
- Transaction atomicity
- Input parameter validation

## Service Methods

### 1. `selectWinnerForCycle(equbId: string, cycleId: string): Promise<WinnerSelectionResult>`

**Main Method** - Selects a winner for a payout cycle

**Process Flow:**
1. Validates cycle exists and is in drawable state (OPEN or DRAWING)
2. Retrieves eligible members (filters applied)
3. Verifies at least 1 eligible member exists
4. Generates cryptographic random seed
5. Selects winner using seed-based randomization
6. Executes atomic transaction:
   - Inserts winner_selections record
   - Updates payout_cycles with winner ID and status
   - Marks winner as past_winner
   - Creates payout_history record (PENDING status)
   - Creates payment_reminder (PAYOUT_READY type)
7. Creates audit log entry
8. Returns detailed result

**Returns:**
```typescript
{
  success: boolean;
  payoutCycleId: string;
  winnerId: string;
  winnerName: string;
  winnerPhone: string;
  potAmount: number;
  electedAt: Date;
  totalEligibleMembers: number;
  prngSeed: string;
  message: string;
}
```

**Throws:**
- `NotFoundException` - If cycle not found
- `BadRequestException` - If no eligible members or cycle not drawable
- `ConflictException` - If winner already selected (implicit via validation)
- `InternalServerErrorException` - If transaction fails

**Example Usage:**
```typescript
const result = await lotteryService.selectWinnerForCycle(equbId, cycleId);
console.log(`${result.winnerName} wins ${result.potAmount}!`);
```

---

### 2. `getEligibleMembers(cycleId: string): Promise<MemberEligibility[]>`

**Helper Method** - Retrieves all eligible members for a cycle

**Eligibility Criteria:**
- ✅ `has_paid_contribution` = TRUE
- ✅ `is_past_winner` = FALSE (not already won)
- ✅ `has_opted_out` = FALSE
- ✅ `is_active_member` = TRUE

**Returns:** Array of MemberEligibility objects sorted by member_id

**Throws:** `InternalServerErrorException` on query error

**Example:**
```typescript
const members = await lotteryService.getEligibleMembers(cycleId);
console.log(`Found ${members.length} eligible members`);
```

---

### 3. `validateDrawConditions(cycleId: string): Promise<DrawValidationResult>`

**Pre-Draw Validation** - Validates all conditions before drawing

**Checks:**
- Cycle exists
- Cycle status is OPEN or DRAWING
- Cycle does not already have a winner selected
- At least 1 eligible member exists

**Returns:**
```typescript
{
  valid: boolean;
  errors: string[];
  warnings?: string[];
  eligibleMemberCount?: number;
}
```

**Example:**
```typescript
const validation = await lotteryService.validateDrawConditions(cycleId);
if (!validation.valid) {
  console.error('Draw validation failed:', validation.errors);
}
```

---

### 4. `verifyPastWinner(cycleId: string, memberId: string): Promise<boolean>`

**Status Check** - Verifies if a member is a past winner

**Returns:** `true` if member won in this cycle, `false` otherwise

**Throws:** `InternalServerErrorException` on query error

**Example:**
```typescript
const isPastWinner = await lotteryService.verifyPastWinner(cycleId, memberId);
if (isPastWinner) {
  console.log('Member already won this cycle');
}
```

---

### 5. `canUndoSelection(selectionId: string): Promise<boolean>`

**Undo Validation** - Checks if a selection can be reversed

**Conditions for Undo:**
- Selection exists
- Cycle is still in DRAWING state
- No payments have been processed

**Returns:** `true` if reversible, `false` otherwise

**Example:**
```typescript
if (await lotteryService.canUndoSelection(selectionId)) {
  // Proceed with undo operation
}
```

---

### 6. `verifyReproducibility(cycleId: string, seed: string): Promise<string>`

**Verification Method** - Verifies winner selection with a specific seed

**Purpose:** Allows external verification that the same seed produces the same winner (deterministic behavior)

**Returns:** The member ID that would be selected with the given seed

**Throws:**
- `BadRequestException` - If no eligible members
- `InternalServerErrorException` - On query error

**Example:**
```typescript
const expectedWinner = await lotteryService.verifyReproducibility(
  cycleId,
  originalSeed
);
console.log(`Verified: seed produces winner ${expectedWinner}`);
```

---

## Data Models

### WinnerSelectionResult Interface
```typescript
interface WinnerSelectionResult {
  success: boolean;
  payoutCycleId: string;
  winnerId: string;
  winnerName: string;
  winnerPhone: string;
  potAmount: number;
  electedAt: Date;
  totalEligibleMembers: number;
  prngSeed: string;
  message: string;
}
```

### MemberEligibility Interface
```typescript
interface MemberEligibility {
  member_id: string;
  member_name: string;
  member_phone: string;
  has_paid_contribution: boolean;
  is_past_winner: boolean;
  has_opted_out: boolean;
  is_active_member: boolean;
}
```

### DrawValidationResult Interface
```typescript
interface DrawValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  eligibleMemberCount?: number;
}
```

---

## Transaction Flow

The `selectWinnerForCycle` method executes an atomic transaction with the following operations:

```
START TRANSACTION
├── Insert winner_selections record
├── Update payout_cycles (set winner_id, status = 'DRAWING')
├── Update member_eligibility_status (set is_past_winner = true)
├── Insert payout_history record (status = 'PENDING')
├── Insert payment_reminders record (type = 'PAYOUT_READY')
├── If any error → ROLLBACK
└── Otherwise → COMMIT
```

All operations are atomic - either all succeed or all are rolled back.

---

## PRNG (Pseudo-Random Number Generator) Implementation

### Seed Generation
```typescript
// Uses crypto.randomBytes(32) for cryptographic randomness
const seed = randomBytes(32).toString('hex');
// Example: "a1b2c3d4e5f6...z9y8x7w6v5u4t3s2"
```

### Index Selection
```typescript
// Converts seed to number and applies modulo
const seedNumber = BigInt(`0x${seed.substring(0, 16)}`);
const selectedIndex = Number(seedNumber % BigInt(maxIndex));
```

### Properties
- **Deterministic**: Same seed always produces same winner
- **Cryptographic**: Cannot be predicted or manipulated
- **Uniform Distribution**: Fair chance for all eligible members
- **Reproducible**: Can verify selection offline with seed

---

## Error Handling

### Exception Types

| Exception | Scenario | HTTP Status |
|-----------|----------|------------|
| `BadRequestException` | No eligible members, invalid cycle status | 400 |
| `NotFoundException` | Cycle not found | 404 |
| `ConflictException` | Winner already selected | 409 |
| `InternalServerErrorException` | Database error, transaction failure | 500 |

### Error Messages Include:
- Reason for failure
- Current system state
- Suggested resolution

### Retry Logic
- Eligible member queries: Retryable
- Transaction operations: Auto-rollback on error, idempotent
- Audit logging: Non-blocking failures

---

## Usage in Controller

```typescript
@Controller('equbs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(private readonly lotteryService: LotterySelectionService) {}

  @Post(':equbId/cycles/:cycleId/select-winner-lottery')
  @Roles('admin')
  async selectLotteryWinner(
    @Param('equbId') equbId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.selectWinnerForCycle(equbId, cycleId);
  }

  @Get(':equbId/cycles/:cycleId/eligible-members')
  @Roles('admin')
  async getEligible(
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.getEligibleMembers(cycleId);
  }

  @Get(':equbId/cycles/:cycleId/validate-draw')
  @Roles('admin')
  async validateDraw(
    @Param('cycleId') cycleId: string,
  ) {
    return this.lotteryService.validateDrawConditions(cycleId);
  }
}
```

---

## Testing

### Test Coverage
- **60+ unit tests** covering all methods
- **Happy path**: Valid cycle, multiple members, successful draw
- **Edge cases**: Single member, large lists (1000+ members)
- **Error scenarios**: No members, invalid status, transaction failures
- **Determinism**: Same seed produces same result
- **Concurrency**: Transaction isolation

### Running Tests
```bash
# Run all tests
npm test

# Run lottery service tests only
npm test lottery-selection.service.spec

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Example Test Cases
```typescript
// Happy path
✓ should successfully select a winner from eligible members
✓ should handle single eligible member scenario

// Validation
✓ should throw BadRequestException when no eligible members found
✓ should fail validation if cycle not found
✓ should fail validation if cycle status is not drawable

// Transaction Management
✓ should properly connect and release QueryRunner
✓ should rollback transaction on error
✓ should insert all necessary records in transaction

// Determinism
✓ should be deterministic - same seed yields same result
✓ should return same winner with same seed
```

---

## Performance Considerations

### Query Optimization
- Index on `payout_cycle_id`, `member_id`, `is_past_winner` for eligibility queries
- Index on `selected_winner_id` for duplicate prevention
- Use connection pooling for concurrent requests

### Transaction Performance
- QueryRunner release is always called (finally block)
- Batch inserts where possible
- Keep transaction scope minimal

### PRNG Performance
- `crypto.randomBytes()` is fast (~< 1ms for 32 bytes)
- BigInt modulo operation is O(1)
- Overall winner selection is O(n log n) where n = eligible members

---

## Logging

### Log Levels

**INFO** - Major operations:
```
Starting lottery selection for equb: equb-1, cycle: cycle-1
Retrieved 50 eligible members for cycle cycle-1
Winner selected: member-25 from 50 eligible members
Lottery selection completed successfully for cycle cycle-1
```

**DEBUG** - Detailed tracing:
```
Generated PRNG seed at 2024-01-15T10:30:45.123Z
Selected index: 24 from 50 members
Winner selection transaction committed for cycle cycle-1
```

**WARN** - Recoverable issues:
```
Draw validation failed for cycle cycle-1. Errors: [...]
Cannot undo selection - cycle status is 'COMPLETED'
Failed to create audit log entry: database error
```

**ERROR** - System errors:
```
No eligible members found for lottery draw
Failed to generate PRNG seed: [...error details...]
Winner selection transaction failed: [...error details...]
```

---

## Security & Compliance

### Cryptographic Security
- ✅ Uses `crypto.randomBytes()` (cryptographically secure)
- ✅ NOT `Math.random()` (predictable, unsuitable for this use case)
- ❌ Cannot be predicted by external parties
- ❌ Cannot be manipulated to favor specific members

### Audit Trail
- ✅ All selections logged with seed and timestamp
- ✅ Audit entries non-blocking (service continues if audit fails)
- ✅ Selectable audit retrieval via audit log queries

### Atomicity & Consistency
- ✅ All-or-nothing transaction semantics
- ✅ No partial state on failure
- ✅ Automatic rollback on error

### Authorization
- ✅ Admin-only access (via `@Roles('admin')` guard)
- ✅ Equb/cycle ownership verification (recommended in controller)

---

## Troubleshooting

### Issue: "No eligible members found"
**Causes:**
- All members haven't paid contributions
- All members are past winners
- All members have opted out

**Solution:** Check member eligibility status, ask members to pay/opt-in

### Issue: "Cycle already has a selected winner"
**Causes:**
- Selection already made in this cycle
- Trying to draw twice

**Solution:** Check cycle status, use `verifyReproducibility` to verify existing selection

### Issue: "Transaction failed"
**Causes:**
- Database connection lost
- Deadlock with concurrent request
- Insufficient permissions

**Solution:** Check database, retry operation, verify transaction isolation level

### Issue: "PRNG seed generation failed"
**Causes:**
- Insufficient system entropy
- Crypto module not available

**Solution:** Check system entropy sources, ensure Node.js crypto module is available

---

## Future Enhancements

1. **Multiple Selection Methods**: Add ROTATION and MANUAL methods alongside LOTTERY
2. **Batch Operations**: Select multiple winners in one cycle
3. **Custom Rules**: Extensible eligibility criteria system
4. **Analytics**: Track selection fairness metrics
5. **Notifications**: Automatic SMS/email to winners
6. **History Export**: Generate audit reports

---

## References

- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [NestJS Transactions](https://docs.nestjs.com/techniques/database#transactions)
- [TypeORM Query Runner](https://typeorm.io/transactions)
- [BigInt in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test cases for usage examples
3. Check audit logs for operation details
4. Contact the development team

