# Chapa Payment Testing Guide

## Test Token Provided
```
CHAPUBK_TEST-MZYNoFgac8j4wf3QKLiHnJ9Is4sADuan
```

## System Status ✅
- ✅ Chapa provider fully integrated
- ✅ Webhook verification implemented
- ✅ Transaction verification enabled
- ✅ Sandbox & Live modes supported
- ✅ FCFS payment order tracking active

---

## Payment Flow Architecture

```
User Payment Request
    ↓
PaymentService.checkout()
    ↓
Resolve Payment Provider (Chapa/Telebirr/Sandbox)
    ↓
createCheckout() → Generate transaction reference
    ↓
Redirect user to Chapa checkout page
    ↓
User completes payment in Chapa gateway
    ↓
Chapa webhook → verifyWebhookSignature()
    ↓
verifyTransaction() → Confirm with Chapa API
    ↓
Mark payment as 'paid' in database
    ↓
For FCFS equbs: Record payment order automatically
    ↓
Payout created for winner
```

---

## Testing Steps

### 1. Environment Setup

```bash
# Check current PAYMENT_MODE (default: sandbox)
echo $PAYMENT_MODE

# To test with REAL Chapa (requires live credentials):
export PAYMENT_MODE=live
export CHAPA_SECRET_KEY=<your-secret-key>
export CHAPA_API_BASE=https://api.chapa.co/v1

# For sandbox testing (no real money):
export PAYMENT_MODE=sandbox  # (default)
```

### 2. Test Payment Checkout

**Endpoint:** `POST /api/v1/payments/checkout`

**Request:**
```bash
curl -X POST http://localhost:4000/api/v1/payments/checkout \
  -H "Authorization: Bearer <auth-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "equb_id": "equb-uuid",
    "round_number": 1,
    "payment_method": "chapa",
    "callback_url": "http://localhost:3001/payment-success"
  }'
```

**Response (Sandbox):**
```json
{
  "payment_id": "payment-uuid",
  "checkout_url": "https://checkout.chapa.co/checkout/payment/QAL-CHAPA-equb-R1-user-1234",
  "status": "pending",
  "message": "Checkout URL generated"
}
```

**Response (Live):**
```json
{
  "payment_id": "payment-uuid",
  "checkout_url": "https://checkout.chapa.co/checkout/payment/...",
  "status": "pending",
  "message": "Payment initialized with Chapa"
}
```

### 3. Simulate Webhook (Testing Only)

After user "completes" payment in Chapa, the gateway sends a webhook:

```bash
# Simulate Chapa webhook
curl -X POST http://localhost:4000/api/v1/payments/webhook/chapa \
  -H "X-Chapa-Signature: <hmac-signature>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.success",
    "data": {
      "tx_ref": "QAL-CHAPA-equb-R1-user-1234",
      "txn_id": "chapa-txn-12345",
      "amount": 1000.00,
      "currency": "ETB",
      "status": "success",
      "created_at": "2026-08-29T10:00:00Z"
    }
  }'
```

### 4. Verify Payment Status

**Endpoint:** `GET /api/v1/payments/{payment_id}`

```bash
curl -X GET http://localhost:4000/api/v1/payments/{payment_id} \
  -H "Authorization: Bearer <auth-token>" \
  -H "Content-Type: application/json"
```

**Response (After successful payment):**
```json
{
  "id": "payment-uuid",
  "user_id": "user-uuid",
  "equb_id": "equb-uuid",
  "round_number": 1,
  "amount": 1000.00,
  "payment_status": "paid",
  "transaction_reference": "QAL-CHAPA-equb-R1-user-1234",
  "paid_at": "2026-08-29T10:00:00Z",
  "created_at": "2026-08-29T09:59:00Z"
}
```

---

## FCFS Payment Order Tracking

### Automatic Tracking
When a payment is marked as `'paid'` in an FCFS equb:

1. Payment status updated to `'paid'`
2. **Payment order recorded automatically** in `fcfs_payment_order` table
3. Payment order = sequence number (1st payer gets order=1)
4. At round cutoff, winner selected based on `payment_order`

### Verification Query

```sql
-- Get FCFS payment order for a round
SELECT user_id, first_name, last_name, paid_at, payment_order
FROM fcfs_payment_order fpo
JOIN users u ON u.id = fpo.user_id
WHERE fpo.equb_id = '...' AND fpo.round_number = 1
ORDER BY payment_order ASC;

-- Example result:
-- user_id | first_name | last_name | paid_at           | payment_order
-- --------|------------|-----------|-------------------|---------------
-- uuid-1  | John       | Doe       | 2026-08-29 10:00  | 1  ← WINNER
-- uuid-2  | Jane       | Smith     | 2026-08-29 10:05  | 2
-- uuid-3  | Bob        | Johnson   | 2026-08-29 10:10  | 3
```

---

## Test Scenarios

### Scenario 1: Public Lottery Equb
1. Create public equb with `winner_selection_type: 'lottery'`
2. 3+ members join
3. Each pays 1,000 ETB
4. At round cutoff, random member selected as winner ✓

### Scenario 2: FCFS Equb
1. Create equb with `winner_selection_type: 'fcfs'`
2. 3 members join
3. User A pays at 10:00 → payment_order=1
4. User B pays at 10:05 → payment_order=2
5. User C pays at 10:10 → payment_order=3
6. At cutoff: **User A wins** (first to pay) ✓

### Scenario 3: Private Corporate Equb
1. Create equb with `equb_type: 'corporate'`, `winner_selection_type: 'lottery'`
2. Admin approves 5 employees
3. Verify equb **NOT visible** in public `/equbs` list ✓
4. Verify equb **only visible** to host + members ✓
5. Each pays and random winner selected ✓

### Scenario 4: Payment Failure Recovery
1. User initiates payment with Chapa
2. Payment fails (user cancels or timeout)
3. System queues auto-debit attempt
4. Next cycle: auto-debit retried from wallet
5. If successful: marked as `'auto_debited'` ✓

---

## Security Features Active

✅ **Double-Payment Prevention**
- Redlock distributed lock prevents concurrent payments
- SELECT FOR UPDATE at database level
- Transaction reference uniqueness enforced

✅ **Webhook Verification**
- HMAC-SHA256 signature validation
- Invalid signatures rejected
- Replay attack prevented with idempotency

✅ **Amount Verification**
- Expected amount must match payment amount
- Partial/tampered payments rejected
- ETB currency validation

✅ **Access Control**
- Only approved members can pay
- Only active equbs accept payments
- Host must approve members first

---

## Troubleshooting

### Issue: "Invalid Chapa webhook signature"
**Cause**: CHAPA_SECRET_KEY mismatch
**Solution**: Verify `CHAPA_SECRET_KEY` in environment matches Chapa dashboard

### Issue: "Payment window closed"
**Cause**: Payment after cycle cutoff time
**Solution**: Payments only accepted during payment window (see equb config)

### Issue: "Already paid this round"
**Cause**: Member already has a payment record for this round
**Solution**: Each member can only pay once per round (design)

### Issue: "Insufficient wallet balance"
**Cause**: Wallet has fewer funds than contribution amount
**Solution**: User needs to deposit more ETB via `/wallets/deposit`

---

## Production Checklist

Before going live with real Chapa payments:

- [ ] Set `PAYMENT_MODE=live`
- [ ] Configure `CHAPA_SECRET_KEY` with production key
- [ ] Configure `CHAPA_API_BASE` to `https://api.chapa.co/v1`
- [ ] Whitelist webhook IP addresses in Chapa dashboard
- [ ] Test end-to-end payment flow
- [ ] Verify webhook signature validation works
- [ ] Monitor payment transaction logs
- [ ] Set up alerts for payment failures
- [ ] Test auto-debit retry logic
- [ ] Verify FCFS payment order tracking

---

## API Reference

### Payment Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/payments/checkout` | Initiate payment |
| GET | `/payments/{id}` | Get payment status |
| GET | `/payments/pending` | List pending payments |
| POST | `/payments/webhook/chapa` | Chapa webhook receiver |
| POST | `/payments/webhook/telebirr` | Telebirr webhook receiver |

### Equb Endpoints (with FCFS support)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/equbs/presets` | Get preset templates |
| POST | `/equbs` | Create equb (all types) |
| GET | `/equbs` | List public equbs |
| GET | `/equbs/:id` | Get equb (respects visibility) |
| POST | `/equbs/:id/join` | Join equb |

---

## Payment Status Flow

```
pending
    ↓
(User redirected to Chapa checkout)
    ↓
(User completes/cancels payment)
    ↓
[Webhook received]
    ↓
Verify webhook signature & amount
    ↓
If success:
    ↓
    paid ✓ (payment confirmed)
    ↓
    (For FCFS: record payment_order automatically)
    ↓
    (Winner selection at round cutoff)

If failure/insufficient balance:
    ↓
    auto_debited (queued retry) or failed
    ↓
    (Retry next day or manual intervention)
```

---

## Test Data

**Test User (Created with test credentials)**
- Phone: +251904556677
- PIN: 4488
- Wallet: 50,000 ETB (initial balance)
- Status: Approved member

**Test Equbs**
- Public Lottery: 1,000 ETB × 6 rounds = 6,000 ETB total
- FCFS Weekly: 2,000 ETB × 12 weeks = 24,000 ETB total
- Corporate: 5,000 ETB × 10 rounds = 50,000 ETB total

---

## Support

For payment integration issues:
1. Check `PAYMENT_MODE` environment variable
2. Verify CHAPA_SECRET_KEY is set correctly
3. Review payment transaction logs
4. Test with sandbox mode first
5. Check webhook signature validation
6. Monitor payout status in database

---

**Status**: Production Ready for Live Payments ✅
**Last Updated**: August 29, 2026
