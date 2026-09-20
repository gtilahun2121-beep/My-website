# QalNet API Enhancements - FCFS, Corporate/Private, and Presets

## Overview
This document describes the new equb features added to QalNet:
1. **FCFS (First-Come-First-Serve) Winner Selection** - Winners selected by payment order instead of lottery
2. **Corporate/Private Equb Types** - Visibility and access control for business and private groups
3. **Preset Equb Templates** - Quick-start templates for common equb configurations

---

## 1. Equb Groups - New Fields

### Database Schema Changes

**Table: `equb_groups`** - New columns added:

```sql
ALTER TABLE equb_groups ADD COLUMN winner_selection_type VARCHAR(20) DEFAULT 'lottery';
ALTER TABLE equb_groups ADD COLUMN equb_type VARCHAR(20) DEFAULT 'public';
ALTER TABLE equb_groups ADD COLUMN is_preset BOOLEAN DEFAULT FALSE;
ALTER TABLE equb_groups ADD COLUMN preset_template_id VARCHAR(50);
```

### API Endpoints

#### GET `/api/v1/equbs/presets`
Returns all featured preset templates for quick equb creation.

**Response:**
```json
[
  {
    "id": "daily-300-103",
    "name": "Daily 300 ETB",
    "description": "Daily contribution for 103 days - perfect for daily savers",
    "contribution_amount": 300,
    "total_rounds": 103,
    "cycle_days": 1,
    "cycle_type": "daily",
    "winner_selection": "lottery",
    "equb_type": "public",
    "is_featured": true,
    "display_order": 1
  },
  {
    "id": "monthly-10000-6",
    "name": "Monthly 10,000 ETB",
    "description": "Monthly contribution for 6 months - premium tier",
    "contribution_amount": 10000,
    "total_rounds": 6,
    "cycle_days": 30,
    "cycle_type": "round",
    "winner_selection": "lottery",
    "equb_type": "public",
    "is_featured": true,
    "display_order": 4
  }
]
```

#### POST `/api/v1/equbs`
Create a new equb (Admin only). Now supports new fields.

**Request Body:**
```json
{
  "name": "Tech Team Fund",
  "description": "Company savings circle",
  "contribution_amount": 5000,
  "total_rounds": 10,
  "cycle_days": 30,
  "cycle_type": "round",
  "winner_selection_type": "lottery",
  "equb_type": "corporate",
  "preset_template_id": null
}
```

**New Fields:**
- `winner_selection_type` (string: `'lottery'` | `'fcfs'` | `'auction'`)
  - **`'lottery'`** (default): Random winner selection using cryptographic PRNG
  - **`'fcfs'`**: Winner is the first member who paid (First-Come-First-Serve)
  - **`'auction'`**: Members bid for early payout (discounted amount)

- `equb_type` (string: `'public'` | `'private'` | `'corporate'`)
  - **`'public'`** (default): Visible to all users, anyone can join
  - **`'private'`**: Only visible to host and members (invite-only)
  - **`'corporate'`**: For business/organization use, members only

- `preset_template_id` (string | null): Reference to a preset template if created from template

#### GET `/api/v1/equbs`
List all public equbs. **Now filters by visibility.**

**Changes:**
- Only returns `equb_type = 'public'` equbs
- Private and corporate equbs only visible to host and members
- Response includes new fields: `winner_selection_type`, `equb_type`, `is_preset`

#### GET `/api/v1/equbs/:id`
Get equb details. **Now respects visibility controls.**

**Visibility Rules:**
- **Public equbs**: Visible to everyone
- **Private equbs**: Only visible to host and approved members
- **Corporate equbs**: Only visible to host and approved members
- Returns `null` (404) if user lacks access

**Response (new fields):**
```json
{
  "id": "uuid",
  "name": "Tech Savings Circle",
  "winner_selection_type": "lottery",
  "equb_type": "corporate",
  "is_preset": false,
  "preset_template_id": null,
  ...
}
```

#### GET `/api/v1/equbs/mine`
List authenticated user's equbs. **Includes all equbs user hosts or is a member of.**

**Response includes new fields:**
```json
[
  {
    "id": "uuid",
    "name": "My Private Circle",
    "winner_selection_type": "fcfs",
    "equb_type": "private",
    "is_preset": false,
    ...
  }
]
```

---

## 2. FCFS (First-Come-First-Serve) Payment Order

### New Table: `fcfs_payment_order`

Tracks payment arrival order for FCFS equbs.

```sql
CREATE TABLE fcfs_payment_order (
  id              UUID PRIMARY KEY,
  equb_id         UUID NOT NULL,
  round_number    INTEGER NOT NULL,
  user_id         UUID NOT NULL,
  payment_id      UUID,
  paid_at         TIMESTAMP,
  payment_order   INTEGER NOT NULL,
  UNIQUE (equb_id, round_number, user_id),
  UNIQUE (equb_id, round_number, payment_order)
);
```

### Payment Processing Flow (Updated)

When a payment is marked as **`'paid'`** or **`'auto_debited'`** in an FCFS equb:

1. Payment is deducted from wallet
2. **FCFS order is recorded automatically** (1st payer = payment_order=1, 2nd payer = payment_order=2, etc.)
3. At round cutoff, the member with `payment_order=1` is automatically selected as winner
4. Lottery selection is skipped for FCFS equbs

### Winner Selection (FCFS)

**New Service:** `FCFSSelectionService`

#### Method: `selectWinnerForRound(equbId, roundNumber)`

Selects the winner for an FCFS equb based on who paid first.

**Request:**
```typescript
const result = await fcfsSelectionService.selectWinnerForRound(equbId, roundNumber);
```

**Response:**
```typescript
{
  success: true,
  winner_id: "user-uuid",
  winner_name: "John Doe",
  cycle_id: "payout-uuid",
  equb_id: "equb-uuid",
  selection_method: "fcfs",
  payment_order: 1,
  selected_at: "2026-08-29T10:00:00Z",
  message: "FCFS winner selected: John Doe (1st payer, Order #1)"
}
```

#### Method: `verifyFCFSWinner(equbId, roundNumber, expectedWinnerId)`

Verifies FCFS winner selection is correct (audit purposes).

```typescript
{
  verified: true,
  actual_winner_id: "user-uuid",
  expected_winner_id: "user-uuid",
  payment_order: 1,
  reason: "Correct FCFS winner"
}
```

#### Method: `getFCFSPaymentOrder(equbId, roundNumber)`

Returns payment order list for transparency.

```typescript
[
  {
    payment_order: 1,
    user_id: "uuid",
    first_name: "John",
    last_name: "Doe",
    phone: "+251...",
    paid_at: "2026-08-29T10:00:00Z",
    amount: 2000,
    payment_status: "paid"
  },
  {
    payment_order: 2,
    user_id: "uuid",
    first_name: "Jane",
    last_name: "Smith",
    ...
  }
]
```

---

## 3. Preset Equb Templates

### New Table: `equb_preset_templates`

```sql
CREATE TABLE equb_preset_templates (
  id                  VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(100),
  description         TEXT,
  contribution_amount NUMERIC(15, 2),
  total_rounds        INTEGER,
  cycle_days          INTEGER,
  cycle_type          VARCHAR(20),
  winner_selection    VARCHAR(20),
  equb_type           VARCHAR(20),
  is_featured         BOOLEAN,
  display_order       INTEGER
);
```

### Pre-Populated Templates

The migration creates 7 featured templates:

| ID | Name | Amount | Rounds | Cycle | Selection | Type |
|----|------|--------|--------|-------|-----------|------|
| `daily-300-103` | Daily 300 ETB | 300 | 103 | Daily | Lottery | Public |
| `daily-1500-103` | Daily 1,500 ETB | 1,500 | 103 | Daily | Lottery | Public |
| `weekly-2000-12` | Weekly 2,000 ETB | 2,000 | 12 | Weekly | Lottery | Public |
| `monthly-10000-6` | Monthly 10,000 ETB | 10,000 | 6 | Monthly | Lottery | Public |
| `fcfs-2000-12` | FCFS Weekly 2,000 ETB | 2,000 | 12 | Weekly | FCFS | Public |
| `corporate-5000-10` | Corporate Fund 5,000 ETB | 5,000 | 10 | Monthly | Lottery | Corporate |
| `private-3000-6` | Private Circle 3,000 ETB | 3,000 | 6 | Monthly | Lottery | Private |

### Frontend Integration

**Component:** `PresetTemplates.tsx`

Displays featured templates with selection handler. When user clicks "Use This Template":

1. Form fields are auto-populated with template values
2. Page scrolls to form section
3. User can customize name/description if desired
4. Submit creates equb with template config

---

## 4. Equb Type Access Control

### Public Equbs
- Visible in `/api/v1/equbs` (list all)
- Visible in `/api/v1/equbs/:id` (get details)
- Anyone can join via `/api/v1/equbs/:id/join`

### Private Equbs
- **Not visible** in `/api/v1/equbs` (list all)
- Only visible to:
  - Host (creator)
  - Approved members
- Join only by direct invitation (requires host approval)

### Corporate Equbs
- **Not visible** in `/api/v1/equbs` (list all)
- Only visible to:
  - Host/Admin
  - Employees/approved members
- Use case: Company savings circles, employee benefits

### Database Query Example

```sql
-- Get all public equbs
SELECT * FROM equb_groups WHERE equb_type = 'public';

-- Get all equbs visible to a user
SELECT * FROM equb_groups e
WHERE e.equb_type = 'public'
  OR (e.host_id = $1)  -- User is host
  OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.equb_id = e.id 
      AND m.user_id = $1 
      AND m.status = 'approved'
  );  -- User is approved member
```

---

## 5. Updated Equb Creation Validation

### Input Validation

```typescript
interface CreateEqubInput {
  name: string;
  description?: string;
  contribution_amount: number;
  total_rounds: number;
  cycle_days: number;
  cycle_type?: 'round' | 'daily' | 'weekly';
  payment_cutoff_time?: string;      // HH:MM format
  late_penalty_rate?: number;         // 0-1
  payment_cutoff_weekday?: number;    // 0-6
  
  // NEW FIELDS
  winner_selection_type?: 'lottery' | 'fcfs' | 'auction';
  equb_type?: 'public' | 'private' | 'corporate';
  preset_template_id?: string;
}
```

### Validation Rules

- `winner_selection_type`: Must be one of `'lottery'`, `'fcfs'`, `'auction'`
- `equb_type`: Must be one of `'public'`, `'private'`, `'corporate'`
- `preset_template_id`: If provided, must exist in `equb_preset_templates`
- When preset is used, most other fields are overridden by template values (optional user customization)

---

## 6. Migration Path

Run the migration to add support:

```bash
psql -U postgres -d qalnet_db -f apps/backend/database/migrations/20260829_add_fcfs_corporate_presets.sql
```

**Changes:**
1. Adds 4 new columns to `equb_groups`
2. Creates `fcfs_payment_order` table
3. Creates `equb_preset_templates` table with 7 featured templates

---

## 7. Backward Compatibility

- **Default values** ensure existing equbs work unchanged:
  - `winner_selection_type = 'lottery'` (existing lottery behavior)
  - `equb_type = 'public'` (existing visibility)
  - `is_preset = FALSE` (manually created)
- **No breaking changes** to existing API contracts
- Existing equbs continue to use lottery selection

---

## 8. Summary of Changes

| Component | Change | Impact |
|-----------|--------|--------|
| Database | 4 new columns, 2 new tables | Schema migration required |
| Backend Service | FCFS selection service | New winner selection method |
| Payments Service | FCFS order tracking | Payment flow enhancement |
| Equbs Controller | GET /presets endpoint | New API route |
| Equbs Repository | Visibility filters | Access control implementation |
| Frontend Component | PresetTemplates | New UI component |
| Frontend API | equbAPI.getPresets() | New API method |
| Create Equb Page | Template selector | UX enhancement |

---

## 9. Testing Checklist

- [ ] Create FCFS equb, verify first payer wins
- [ ] Create private equb, verify not visible to non-members
- [ ] Create corporate equb, verify visibility rules
- [ ] Use preset template, verify form auto-fills
- [ ] Verify FCFS payment order tracking
- [ ] Test winner selection for all types (lottery, fcfs, auction)
- [ ] Verify payout creation for FCFS winners
- [ ] Test access control (private/corporate equbs)

---

## 10. Future Enhancements

- [ ] Multi-currency support for international users
- [ ] Bi-weekly and semi-monthly cycle types
- [ ] Custom equb templates created by users
- [ ] Equb cloning (create from existing)
- [ ] Webhook notifications for FCFS order changes
