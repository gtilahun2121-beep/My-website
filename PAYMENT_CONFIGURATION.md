# QalNet Payment Gateway Configuration Guide

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

QalNet supports two real payment gateways for Ethiopian users:

1. **Chapa** - Modern payment platform for card/wallet payments
2. **Telebirr** - Telecom-integrated payments (Ethio Telecom)

Both gateways are **fully integrated** in the production code. This guide explains how to configure them with real credentials.

---

## Architecture

### Secrets Management

**Production (AWS):**
```
.env (local) → AWS Secrets Manager (encrypted)
              ↓
        VaultConfig.load()
              ↓
        ChapaPaymentProvider
        TelebirrPaymentProvider
```

**Development (Local):**
```
.env (plaintext) → VaultConfig.load() → Payment Providers
```

⚠️ **Security:** Never commit `.env` to Git. Production uses AWS Secrets Manager.

---

## Part 1: Chapa Payment Gateway Setup

### Step 1: Create Chapa Business Account

1. Visit **https://chapa.co**
2. Click "Sign Up"
3. Choose "Business"
4. Fill in your business details:
   - Business name: QalNet Digital Equb
   - Country: Ethiopia
   - Phone: +251XXXXXXXXX
   - Email: business@qalnet.com
5. Complete verification (ID upload, address verification)
6. Account approved (24-48 hours typically)

### Step 2: Get API Keys

1. Log in to Chapa dashboard
2. Navigate to **Settings → API Keys**
3. You'll see two keys:
   - **Public Key** - starts with `CHAPUBK_`
   - **Secret Key** - starts with `CHASECK_`

**Copy both values carefully:**

```bash
# For DEVELOPMENT/TESTING:
CHAPA_PUBLIC_KEY=CHAPUBK_test_xxxxxxxxxxxxxxxxxxxx
CHAPA_SECRET_KEY=CHASECK_TEST-JXfelzS59KnCESAXpB390yHrLqG1k5tF

# For PRODUCTION (after account verification):
CHAPA_PUBLIC_KEY=CHAPUBK_live_xxxxxxxxxxxxxxxxxxxx
CHAPA_SECRET_KEY=CHASECK_live_xxxxxxxxxxxxxxxxxxxx
```

### Step 3: Configure in .env

Add to your `.env` file:

```bash
# Chapa Payment Gateway
CHAPA_PUBLIC_KEY=CHAPUBK_your-public-key-here
CHAPA_SECRET_KEY=CHASECK_your-secret-key-here
CHAPA_API_BASE=https://api.chapa.co/v1
CHAPA_CHECKOUT_BASE=https://checkout.chapa.co/checkout/payment
```

### Step 4: Test Integration

```bash
# Start backend
npm run start:backend

# In another terminal, test payment creation
curl -X POST http://localhost:4000/api/v1/payments/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 1000,
    "currency": "ETB",
    "description": "Test payment",
    "email": "test@example.com"
  }'

# Response should include checkout URL:
# {
#   "checkoutUrl": "https://checkout.chapa.co/checkout/payment/..."
# }
```

### Step 5: Configure Webhooks (Optional)

Chapa webhooks notify you when payments succeed:

1. Go to Chapa dashboard → **Settings → Webhooks**
2. Add webhook URL:
   ```
   https://your-api-domain.com/api/v1/payments/webhook/chapa
   ```
3. Select events:
   - ✅ Payment Completed
   - ✅ Payment Failed
4. Click "Save"

**Webhook Secret:**
- Chapa provides a webhook secret for signature verification
- Add to `.env`:
  ```bash
  CHAPA_WEBHOOK_SECRET=your-webhook-secret-from-dashboard
  ```

---

## Part 2: Telebirr Payment Gateway Setup

### Step 1: Register as Merchant

1. Visit **https://developer.ethiotelecom.et**
2. Click "Merchant Registration"
3. Fill in details:
   - Business Name: QalNet Digital Equb
   - Email: business@qalnet.com
   - Phone: +251XXXXXXXXX
   - Business Category: Financial Services
4. Submit for verification
5. Approval: 2-5 business days

### Step 2: Get Merchant Credentials

After approval:

1. Log in to Telebirr Developer Portal
2. Navigate to **My Applications**
3. Create new application:
   - Name: "QalNet Backend"
   - Type: "Server-to-Server"
4. You'll receive:
   - **App ID** - your merchant identifier
   - **App Secret** - used for request signing
   - **API Keys** - for authentication

**Copy these values:**

```bash
TELEBIRR_APP_KEY=your-app-id-from-portal
TELEBIRR_APP_SECRET=your-app-secret-from-portal
```

### Step 3: Configure in .env

Add to your `.env` file:

```bash
# Telebirr Payment Gateway
TELEBIRR_APP_KEY=your-telebirr-app-id
TELEBIRR_APP_SECRET=your-telebirr-app-secret
TELEBIRR_API_BASE=https://pay.telebirr.et
TELEBIRR_CHECKOUT_BASE=https://telebirr.et/checkout
```

### Step 4: Test Integration

```bash
# Start backend
npm run start:backend

# Test payment creation
curl -X POST http://localhost:4000/api/v1/payments/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "amount": 1000,
    "currency": "ETB",
    "provider": "telebirr",
    "description": "Test Telebirr payment"
  }'

# Response should include Telebirr checkout URL
```

### Step 5: IP Whitelisting

Telebirr requires IP whitelisting for security:

1. Go to **Settings → IP Whitelist** in developer portal
2. Add your backend server's public IP:
   ```
   203.0.113.42  # Example - use your actual server IP
   ```
3. If deploying to AWS/GCP/Azure, use their static IP address

---

## Part 3: Environment Variable Configuration

### Development (.env Local)

```bash
# Development with test credentials
NODE_ENV=development

# Chapa Test Keys
CHAPA_PUBLIC_KEY=CHAPUBK_test_xxx
CHAPA_SECRET_KEY=CHASECK_TEST-JXfelzS59KnCESAXpB390yHrLqG1k5tF

# Telebirr Sandbox Credentials
TELEBIRR_APP_KEY=sandbox-app-key
TELEBIRR_APP_SECRET=sandbox-app-secret

# Use local database
DATABASE_URL=postgresql://qalnet_app:password@localhost:5432/qalnet_dev
REDIS_URL=redis://localhost:6379
```

### Production (.env Production)

**NEVER commit production .env to Git.**

Instead, use AWS Secrets Manager:

```bash
# Tell the app to fetch secrets from AWS
NODE_ENV=production
AWS_REGION=us-east-1
AWS_SECRET_NAME=qalnet/production/secrets

# AWS credentials (from IAM user with Secrets Manager access)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

The `VaultConfig` class will automatically fetch these secrets from AWS Secrets Manager.

---

## Part 4: AWS Secrets Manager Setup (Production)

### Step 1: Create Secret in AWS

```bash
# Create secret with all payment credentials
aws secretsmanager create-secret \
  --name qalnet/production/secrets \
  --region us-east-1 \
  --secret-string '{
    "CHAPA_SECRET_KEY": "CHASECK_live_xxx",
    "TELEBIRR_APP_KEY": "your-app-id",
    "TELEBIRR_APP_SECRET": "your-app-secret",
    "DATABASE_URL": "postgresql://...",
    "JWT_PRIVATE_KEY": "-----BEGIN RSA PRIVATE KEY-----...",
    "JWT_PUBLIC_KEY": "-----BEGIN PUBLIC KEY-----...",
    "REDIS_URL": "redis://...",
    "ARGON2_PEPPER": "random-pepper",
    "PGCRYPTO_SYMMETRIC_KEY": "symmetric-key",
    "ADMIN_BOOTSTRAP_TOKEN": "one-time-token"
  }'
```

### Step 2: Grant IAM Permissions

```bash
# Create IAM policy for backend EC2/Lambda instances
aws iam create-policy \
  --policy-name QalNetSecretsManagerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:qalnet/production/secrets-*"
    }]
  }'

# Attach to backend IAM role
aws iam attach-role-policy \
  --role-name backend-server-role \
  --policy-arn arn:aws:iam::123456789012:policy/QalNetSecretsManagerAccess
```

### Step 3: Backend Initialization

```typescript
// main.ts (application startup)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VaultConfig } from './config/vault.config';

async function bootstrap() {
  // Load secrets BEFORE creating app
  const secrets = await VaultConfig.load();
  
  // Now secrets are cached for the entire app lifetime
  const app = await NestFactory.create(AppModule);
  
  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
```

---

## Part 5: Testing Payment Integration

### Test Scenarios

#### Scenario 1: Successful Payment (Chapa)

```bash
# 1. Create checkout
curl -X POST http://localhost:4000/api/v1/payments/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 1000, "provider": "chapa"}'

# 2. User completes payment in Chapa UI
# (Use Chapa test card: 4242 4242 4242 4242)

# 3. Chapa redirects to callback URL
# GET /callback?tx_ref=qalnet_xxx&status=success

# 4. Backend verifies with Chapa
# Payment marked as completed

# 5. Wallet balance updated
```

#### Scenario 2: Failed Payment (Telebirr)

```bash
# 1. Create Telebirr checkout
curl -X POST http://localhost:4000/api/v1/payments/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"amount": 1000, "provider": "telebirr"}'

# 2. User declines on Telebirr UI

# 3. Telebirr callback: status=failed
# Payment marked as failed

# 4. User can retry
```

#### Scenario 3: Webhook Verification

```bash
# Chapa sends webhook
POST /api/v1/payments/webhook/chapa \
  -H "X-Chapa-Signature: hmac-sha256-signature" \
  -d '{
    "event": "charge.success",
    "data": {
      "amount": 1000,
      "tx_ref": "qalnet_xxx",
      "status": "success"
    }
  }'

# Backend verifies signature
# Updates payment status
```

---

## Part 6: Monitoring & Troubleshooting

### Check Payment Gateway Status

```bash
# Verify Chapa connectivity
curl https://api.chapa.co/v1/transaction/initialize \
  -H "Authorization: Bearer $CHAPA_SECRET_KEY" \
  -d '{"test": "ping"}'

# Verify Telebirr connectivity
curl https://pay.telebirr.et/api/v3/merchant/authorize \
  -H "Authorization: $TELEBIRR_APP_KEY" \
  -d '{"test": "ping"}'
```

### Common Issues

**Issue:** "Invalid Chapa Secret Key"  
**Solution:** Double-check secret key copy - extra spaces cause failures

**Issue:** "Telebirr IP not whitelisted"  
**Solution:** Add server IP to Telebirr dashboard → Settings → IP Whitelist

**Issue:** "Webhook signature mismatch"  
**Solution:** Verify webhook secret matches in both Chapa dashboard and `.env`

**Issue:** "Payment pending forever"  
**Solution:** Check database reconciliation jobs, ensure webhooks are working

### Logging

Enable payment debug logging:

```bash
LOG_LEVEL=debug

# In backend, payment logs will show:
# [ChapaPaymentProvider] Checkout init: tx_ref=qalnet_xxx amount=1000
# [TelebirrPaymentProvider] Verify successful
# [PaymentWebhookService] Webhook signature verified
```

---

## Part 7: Security Best Practices

### ✅ DO

- Store secrets in AWS Secrets Manager (production)
- Use HTTPS for all payment communications
- Verify webhook signatures
- Rotate API keys annually
- Log payment events (without sensitive data)
- Use IP whitelisting for Telebirr
- Test with sandbox credentials first

### ❌ DON'T

- Commit `.env` to version control
- Share API keys via email
- Use test keys in production
- Log full payment details
- Expose public keys to frontend unnecessarily
- Skip webhook verification

### Compliance

- ✅ PCI DSS Level 1 (outsourced to payment providers)
- ✅ GDPR compliant (no unnecessary data retention)
- ✅ Ethiopia NBEE compliant (local payment gateways)
- ✅ Encrypted secrets at rest (AWS KMS)
- ✅ Encrypted secrets in transit (HTTPS)

---

## Part 8: Switching Between Test & Production

### Switch to Test Mode

```bash
# .env
NODE_ENV=development

# Use test keys from Chapa/Telebirr dashboards
CHAPA_SECRET_KEY=CHASECK_TEST-xxx
TELEBIRR_APP_KEY=sandbox-xxx
```

### Switch to Production Mode

```bash
# .env (production server only - never local)
NODE_ENV=production

# AWS will provide secrets from Secrets Manager
AWS_SECRET_NAME=qalnet/production/secrets
```

### Verify Active Configuration

```bash
# Check which secrets are loaded
curl http://localhost:4000/api/v1/admin/config/status
# Returns: {
#   "environment": "production",
#   "paymentProvider": "chapa",
#   "databaseConnected": true,
#   "secretsLoaded": true
# }
```

---

## Part 9: Cost Estimation

### Chapa Fees
- **Card Payments:** 3% + 1 ETB
- **Mobile Money:** 2% + 0.50 ETB
- **Volume Discount:** Negotiable at 10M+ ETB/month

### Telebirr Fees
- **Payment Initiation:** 1% commission
- **Merchant Activation:** Free
- **Settlement:** Daily to merchant account

### Monthly Estimate (10K users, 5K avg contribution)
```
10,000 users × 5,000 ETB = 50,000,000 ETB/month

Chapa (3%): 1,500,000 ETB
Telebirr (1%): 500,000 ETB

Total Payment Fees: ~2,000,000 ETB/month
```

---

## References

- [Chapa API Documentation](https://developer.chapa.co)
- [Telebirr Developer Portal](https://developer.ethiotelecom.et)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [PCI DSS Compliance Guide](https://www.pcisecuritystandards.org/)

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Configuration:** Real payment gateways with secure secrets management
