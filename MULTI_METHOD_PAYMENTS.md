# Multi-Method Payment Processing System

## Overview

QalNet now supports four payment methods for contributing to equbs:

1. **Chapa** - Online payment gateway (instant)
2. **Telebirr** - Mobile money service (instant)
3. **Dashen Bank** - Direct bank transfer (1-2 hours)
4. **QalNet Wallet** - Internal wallet transfers (instant)

## Architecture

### Service Layer

The `MultiMethodPaymentService` orchestrates payment processing:

```
MultiMethodPaymentService
├── initiatePayment()      // Create payment, get checkout URL
├── verifyPayment()        // Verify with provider, update status
├── getPaymentHistory()    // Retrieve payment records
├── getPaymentDetails()    // Get specific payment info
├── handleProviderWebhook()// Process provider callbacks
└── getAvailablePaymentMethods() // List supported methods
```

### Provider Pattern

Each payment method implements the `PaymentProvider` interface:

```typescript
interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
  verifyTransaction(request: VerifyTransactionRequest): Promise<VerifyTransactionResponse>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): Promise<boolean>;
}
```

### Supported Providers

#### 1. Chapa Provider (`chapa.provider.ts`)
- **Method**: `PaymentMethod.CHAPA`
- **Requirements**: Chapa merchant account + API credentials
- **Environment Variables**:
  - `CHAPA_API_BASE` - API endpoint (default: https://api.chapa.co/v1)
  - `CHAPA_CHECKOUT_BASE` - Checkout URL (default: https://checkout.chapa.co/checkout/payment)
  - `CHAPA_SECRET_KEY` - Merchant secret key (from Vault)

#### 2. Telebirr Provider (`telebirr.provider.ts`)
- **Method**: `PaymentMethod.TELEBIRR`
- **Requirements**: Telebirr merchant account
- **Environment Variables**:
  - `TELEBIRR_API_BASE` - API endpoint
  - `TELEBIRR_API_KEY` - API key
  - `TELEBIRR_SECRET_KEY` - Secret key

#### 3. Dashen Bank Provider (`dashen-bank.provider.ts`) **NEW**
- **Method**: `PaymentMethod.DASHEN_BANK`
- **Type**: Direct bank transfer
- **Supported Banks**: CBE, DBE, DASHEN, NIBE, WBSE
- **Amount Limits**: 100-500,000 ETB
- **Processing Time**: 1-2 hours
- **Fee**: 0.5%
- **Environment Variables**:
  - `DASHEN_API_URL` - API endpoint
  - `DASHEN_API_KEY` - Authentication key
  - `DASHEN_API_SECRET` - HMAC secret for signature verification
  - `DASHEN_MERCHANT_ID` - Merchant identifier

**Bank Account Validation**:
```typescript
dashen.validateBankAccount(accountNumber, bankCode)
// Returns: boolean
// Rules: Account number must be 13 digits, bank code must be supported
```

#### 4. Wallet Transfer Provider (`wallet-transfer.provider.ts`) **NEW**
- **Method**: `PaymentMethod.WALLET`
- **Type**: Internal transfer
- **Amount Limits**: 10-100,000 ETB
- **Processing Time**: Instant
- **Fee**: 0% (no external gateway fees)
- **Database**: Uses `wallet_transfers` table for ledger
- **Transaction**: Atomic - both wallets updated in transaction

**Wallet Operations**:
```typescript
// Get wallet balance
balance = await provider.getWalletBalance(userId)

// Get transfer history
history = await provider.getTransferHistory(userId, limit, offset)
```

## API Endpoints

### Base: `/api/v1/payments`

#### Get Available Methods
```
GET /methods
Authorization: Bearer <token>

Response:
{
  "methods": [
    {
      "method": "wallet",
      "name": "QalNet Wallet",
      "description": "Transfer from your QalNet wallet balance",
      "supported": true,
      "minAmount": 10,
      "maxAmount": 100000,
      "processingTime": "instant",
      "fee": 0,
      "icon": "💳",
      "requirements": ["Active wallet"]
    },
    ...
  ],
  "defaultMethod": "wallet",
  "userMethod": "chapa"
}
```

#### Initiate Payment
```
POST /initiate
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "method": "dashen_bank",
  "amount": 500,
  "equbId": "equb-123",
  "roundNumber": 1,
  "metadata": {
    "bankCode": "DASHEN",
    "accountNumber": "1234567890123",
    "accountHolderName": "John Doe"
  }
}

Response:
{
  "paymentId": "payment-uuid",
  "method": "dashen_bank",
  "status": "pending",
  "checkoutUrl": null,
  "providerReference": "dashen-ref-123",
  "externalUrl": false
}
```

#### Verify Payment
```
POST /verify
Authorization: Bearer <token>

Request:
{
  "txRef": "QAL-1695098400000-abc12345",
  "providerReference": "dashen-ref-123",
  "expectedAmount": 500
}

Response:
{
  "success": true,
  "status": "completed",
  "paymentId": "payment-uuid",
  "amount": 500,
  "txRef": "QAL-1695098400000-abc12345",
  "message": "Payment verified successfully"
}
```

#### Get Payment History
```
GET /history?page=1&limit=20
Authorization: Bearer <token>

Response:
{
  "payments": [
    {
      "id": "payment-uuid",
      "userId": "user-uuid",
      "equbId": "equb-uuid",
      "amount": 500,
      "method": "dashen_bank",
      "status": "completed",
      "txRef": "QAL-1695098400000-abc12345",
      "providerReference": "dashen-ref-123",
      "createdAt": "2026-09-24T10:00:00Z",
      "completedAt": "2026-09-24T11:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### Get Payment Details
```
GET /:paymentId
Authorization: Bearer <token>

Response: PaymentInfoDto
```

### Webhook Endpoints

Payment providers send callbacks to:
- `POST /webhook/chapa` - Chapa callbacks
- `POST /webhook/telebirr` - Telebirr callbacks
- `POST /webhook/dashen` - Dashen Bank callbacks
- `POST /webhook/wallet` - Internal wallet callbacks

## Database Schema

### payments table (enhanced)
```sql
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(150);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tx_metadata JSONB;
```

### wallet_transfers table (new)
```sql
CREATE TABLE wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
  reference VARCHAR(150) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_wallet_transfers_from ON wallet_transfers (from_user_id, created_at DESC);
CREATE INDEX idx_wallet_transfers_to ON wallet_transfers (to_user_id, created_at DESC);
```

## Configuration

### Environment Variables

```env
# Dashen Bank
DASHEN_API_URL=https://api.dashenpay.com/v1
DASHEN_API_KEY=your-api-key
DASHEN_API_SECRET=your-api-secret
DASHEN_MERCHANT_ID=your-merchant-id

# Existing providers
CHAPA_API_BASE=https://api.chapa.co/v1
CHAPA_CHECKOUT_BASE=https://checkout.chapa.co/checkout/payment
CHAPA_SECRET_KEY=<from-vault>

TELEBIRR_API_BASE=https://api.telebirr.com
TELEBIRR_API_KEY=<api-key>
TELEBIRR_SECRET_KEY=<secret-key>

APP_URL=https://qalnet.app
```

## Integration

### NestJS Module

```typescript
@Module({
  controllers: [
    PaymentsController,
    MultiMethodPaymentController, // New
    LotteryController,
    UserLotteryController,
    AuctionController
  ],
  providers: [
    PaymentsService,
    MultiMethodPaymentService, // New
    ChapaPaymentProvider,
    TelebirrPaymentProvider,
    DashenBankProvider, // New
    WalletTransferProvider, // New
    PaymentProviderService
  ],
  exports: [
    PaymentsService,
    MultiMethodPaymentService,
    PaymentProviderService
  ]
})
export class PaymentsModule {}
```

### Service Injection

```typescript
constructor(
  private multiMethodPaymentService: MultiMethodPaymentService
) {}

// Get available methods
const methods = this.multiMethodPaymentService.getAvailablePaymentMethods();

// Initiate payment
const result = await this.multiMethodPaymentService.initiatePayment(userId, createPaymentDto);

// Verify payment
const verification = await this.multiMethodPaymentService.verifyPayment(userId, verifyPaymentDto);
```

## Workflow Examples

### Wallet-to-Wallet Transfer
```
1. User initiates payment with method=wallet
2. System validates recipient exists
3. Creates wallet_transfer record (status=pending)
4. On verification, creates transaction in atomic block:
   - Deducts from source wallet
   - Credits to destination wallet
   - Updates transfer status=completed
   - Records transaction in both ledgers
5. Returns success response
```

### Dashen Bank Transfer
```
1. User selects dashen_bank method
2. System validates bank account format
3. Creates payment record with provider_reference
4. Sends to Dashen API for processing
5. Returns checkout details to user
6. User verifies payment when complete
7. System queries Dashen API for status
8. Updates payment record with verified status
9. Webhook from Dashen confirms (optional)
```

### External Gateway (Chapa/Telebirr)
```
1. User selects chapa/telebirr
2. System creates payment record
3. Gets checkout URL from provider
4. Redirects user to external checkout page
5. User completes payment on provider site
6. Provider redirects back to callback
7. Webhook received, payment status updated
8. User can verify payment status manually
```

## Error Handling

### Payment Validation Errors

```typescript
// Invalid payment method
BadRequestException: "Payment method dashen_bank not supported"

// Amount out of range
BadRequestException: "Amount must be between 100 and 500000 ETB"

// Payment not found
NotFoundException: "Payment not found"

// Verification failed
PaymentVerificationResultDto: {
  success: false,
  status: PaymentStatus.FAILED,
  failureReason: "Insufficient balance" | "Amount mismatch" | "Gateway error"
}
```

## Security

### Signature Verification
All webhook signatures verified using HMAC-SHA256:

```typescript
const expectedSignature = crypto
  .createHmac('sha256', apiSecret)
  .update(rawBody)
  .digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

### Amount Validation
- All amounts validated against method-specific limits
- Transaction amount verified against expected amount
- Failure reasons logged for auditing

### User Isolation
- All queries scoped to user ID from JWT
- Wallet transfers require both users to exist
- Transaction isolation ensures atomicity

## Migration

Run migration to add new tables and columns:

```bash
# Applied via: 20260922_add_multi_method_payments.sql
npx typeorm migration:run
```

## Testing

### Unit Tests
- Provider implementations tested independently
- Mock DataSource for database operations
- Service methods validated with mock providers

### Integration Tests
- Full payment flow with all 4 methods
- Webhook handling and verification
- Payment history pagination
- Error handling and recovery

### Manual Testing

```bash
# 1. Start backend
npm run dev

# 2. Test Wallet Transfer
curl -X POST http://localhost:3000/api/v1/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "wallet",
    "amount": 500,
    "equbId": "equb-123",
    "metadata": { "toUserId": "user-456" }
  }'

# 3. Test Dashen Bank Transfer
curl -X POST http://localhost:3000/api/v1/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "dashen_bank",
    "amount": 1000,
    "equbId": "equb-123",
    "metadata": {
      "bankCode": "DASHEN",
      "accountNumber": "1234567890123",
      "accountHolderName": "John Doe"
    }
  }'

# 4. Verify payment
curl -X POST http://localhost:3000/api/v1/payments/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "txRef": "QAL-1695098400000-abc12345",
    "expectedAmount": 500
  }'
```

## Files Modified/Created

**New Files:**
- `src/modules/payments/providers/dashen-bank.provider.ts` - Dashen Bank integration
- `src/modules/payments/providers/wallet-transfer.provider.ts` - Wallet transfer logic
- `src/modules/payments/services/multi-method-payment.service.ts` - Payment orchestration
- `src/modules/payments/multi-method-payment.controller.ts` - API endpoints
- `src/modules/payments/dto/enhanced-payment.dto.ts` - Data transfer objects

**Modified Files:**
- `src/modules/payments/payments.module.ts` - Added new providers and service
- `src/modules/payments/payments.repository.ts` - Extended PaymentRecord interface
- `src/modules/payments/providers/payment-provider.interface.ts` - Extended PaymentProviderName type
- `database/migrations/20260922_add_multi_method_payments.sql` - Schema changes

## Future Enhancements

1. **Payment Reconciliation** - Batch reconciliation with external providers
2. **Partial Refunds** - Support refunding portions of payments
3. **Payment Analytics** - Dashboard with payment method usage and success rates
4. **Recurring Payments** - Automatic payment retries and scheduling
5. **Mobile App Integration** - Deep links for mobile payment flows
6. **Multi-Currency** - Support for multiple currencies beyond ETB
7. **Payment Notifications** - Real-time SMS/email on payment status changes
8. **Audit Trail** - Complete audit log of all payment operations

## Support

For issues or questions:
1. Check environment variables are set correctly
2. Review database migrations have been applied
3. Check API logs for error details
4. Contact payment provider support for specific issues
