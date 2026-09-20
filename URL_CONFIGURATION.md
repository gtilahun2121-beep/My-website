# QalNet URL & API Endpoint Configuration

**Date:** August 29, 2026  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

QalNet uses environment variables for all URLs and API endpoints. This guide explains how to configure them for development, staging, and production environments.

---

## Architecture Overview

```
Development:
┌─────────────────────────────────┐
│ Browser (localhost:3001)        │
│ ├─ /api/* → Next.js Proxy      │
│ └─ → Backend (localhost:4000)  │
└─────────────────────────────────┘

Production:
┌──────────────────────────────────────┐
│ Browser (domain.com)                 │
│ ├─ /api/* → Cloudflare CDN          │
│ ├─ → Load Balancer                  │
│ └─ → Backend Cluster (private IP)   │
└──────────────────────────────────────┘
```

---

## Part 1: Frontend URL Configuration

### Environment Variables

**File:** `apps/web/.env.local`

```bash
# ── Backend API Endpoint ──
# Browser-side: requests go through Next.js proxy (/api/*)
# Server-side (SSR): absolute URL to backend
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# ── Frontend URL ──
# Used for OAuth callbacks, email verification links, password reset links
NEXT_PUBLIC_APP_URL=http://localhost:3001

# ── Node Environment ──
NODE_ENV=development
```

### Development Configuration

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NODE_ENV=development
```

**Flow:**
1. Browser: `GET /api/v1/health` 
2. Next.js proxy: Rewrites to `http://localhost:4000/api/v1/health`
3. Backend responds

### Staging Configuration

```bash
# .env.staging
NEXT_PUBLIC_API_BASE_URL=https://api-staging.qalnet.com
NEXT_PUBLIC_APP_URL=https://staging.qalnet.com
NODE_ENV=production
```

**Flow:**
1. Browser: `GET /api/v1/health`
2. Next.js proxy: Rewrites to `https://api-staging.qalnet.com/api/v1/health`
3. Backend responds

### Production Configuration

```bash
# .env.production
NEXT_PUBLIC_API_BASE_URL=https://api.qalnet.com
NEXT_PUBLIC_APP_URL=https://qalnet.com
NODE_ENV=production
```

**Flow:**
1. Browser: `GET /api/v1/health`
2. Next.js proxy: Rewrites to `https://api.qalnet.com/api/v1/health`
3. Cloudflare CDN → Load Balancer → Backend

### Next.js Configuration

**File:** `apps/web/next.config.ts`

```typescript
async rewrites() {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  return [
    {
      source: '/api/:path*',
      destination: `${backendUrl}/api/:path*`,
    },
  ];
}
```

---

## Part 2: Backend URL Configuration

### Environment Variables

**File:** `apps/backend/.env`

```bash
# ── Database ──
DATABASE_URL=postgresql://user:pass@host:5432/db

# ── CORS Configuration ──
# Comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173

# ── Payment Gateways ──
CHAPA_API_BASE=https://api.chapa.co/v1
CHAPA_CHECKOUT_BASE=https://checkout.chapa.co/checkout/payment
TELEBIRR_API_BASE=https://pay.telebirr.et
TELEBIRR_CHECKOUT_BASE=https://telebirr.et/checkout

# ── Service Endpoints ──
REDIS_URL=redis://localhost:6379
SMS_PROVIDER=ethiosms
```

### Development Configuration

```bash
# .env
DATABASE_URL=postgresql://qalnet_app:dev_password@localhost:5432/qalnet_dev
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173
CHAPA_API_BASE=https://api.chapa.co/v1
TELEBIRR_API_BASE=https://pay.telebirr.et
REDIS_URL=redis://localhost:6379
PAYMENT_MODE=sandbox
NODE_ENV=development
```

### Staging Configuration

```bash
# .env.staging
DATABASE_URL=postgresql://qalnet_staging_user:staging_password@rds-staging.amazonaws.com:5432/qalnet_staging
ALLOWED_ORIGINS=https://staging.qalnet.com,https://admin-staging.qalnet.com
CHAPA_API_BASE=https://api.chapa.co/v1
TELEBIRR_API_BASE=https://pay.telebirr.et
REDIS_URL=redis://redis-staging.internal:6379
PAYMENT_MODE=sandbox
NODE_ENV=production
```

### Production Configuration

```bash
# .env.production (AWS Secrets Manager)
# Never store in plaintext — use AWS Secrets Manager
DATABASE_URL=postgresql://qalnet_prod_user:prod_password@prod-rds.amazonaws.com:5432/qalnet
ALLOWED_ORIGINS=https://qalnet.com,https://api.qalnet.com,https://admin.qalnet.com
CHAPA_API_BASE=https://api.chapa.co/v1
TELEBIRR_API_BASE=https://pay.telebirr.et
REDIS_URL=redis://redis-prod.internal:6379
PAYMENT_MODE=live
NODE_ENV=production
```

---

## Part 3: Complete API Endpoint Reference

### Authentication Endpoints

```
POST   /api/v1/auth/register              - Create new user
POST   /api/v1/auth/login                 - User login
POST   /api/v1/auth/verify-otp            - Verify OTP code
POST   /api/v1/auth/refresh-token         - Refresh access token
POST   /api/v1/auth/logout                - Logout user
```

### Equb Endpoints

```
GET    /api/v1/equbs                      - List all public equbs
GET    /api/v1/equbs/:id                  - Get equb details
GET    /api/v1/equbs/mine                 - Get user's equbs
POST   /api/v1/equbs                      - Create new equb
POST   /api/v1/equbs/:id/join             - Join an equb
POST   /api/v1/equbs/:id/activate         - Activate equb (admin)
POST   /api/v1/equbs/:id/leave            - Leave an equb
```

### Wallet Endpoints

```
GET    /api/v1/wallet                     - Get wallet balance
POST   /api/v1/wallet/deposit             - Deposit funds
POST   /api/v1/wallet/withdraw            - Withdraw funds
GET    /api/v1/wallet/transactions        - Get transaction history
```

### Payment Endpoints

```
POST   /api/v1/payments/checkout          - Create payment checkout
GET    /api/v1/payments/verify/:txRef     - Verify payment status
POST   /api/v1/payments/webhook/chapa     - Chapa webhook receiver
POST   /api/v1/payments/webhook/telebirr  - Telebirr webhook receiver
```

### Admin Endpoints

```
GET    /api/v1/admin/users                - List all users
GET    /api/v1/admin/equbs                - List all equbs
POST   /api/v1/admin/equbs/:id/approve    - Approve pending equb
GET    /api/v1/admin/payments             - List payments
GET    /api/v1/admin/transactions         - List transactions
```

### Health & Status

```
GET    /api/v1/health                     - Health check
GET    /api/v1/config/status              - Config status
GET    /api/v1/version                    - API version
```

---

## Part 4: Domain Configuration Examples

### Example 1: Local Development

```
Frontend:  http://localhost:3001
Backend:   http://localhost:4000
Database:  localhost:5432
Redis:     localhost:6379

API Call Flow:
1. Browser: fetch('/api/v1/equbs')
2. Next.js:  /api/* → localhost:4000/api/v1/equbs
3. Backend:  HTTP response
```

### Example 2: AWS Deployment

```
Frontend:  https://qalnet.com (CloudFront CDN)
Backend:   https://api.qalnet.com (ALB + ECS)
Database:  prod-rds.amazonaws.com (RDS PostgreSQL)
Redis:     redis-cluster.internal (ElastiCache)

API Call Flow:
1. Browser: fetch('/api/v1/equbs')
2. Next.js:  /api/* → CloudFlare → ALB
3. ALB:      Route to ECS Backend (port 4000)
4. Backend:  Response via ALB → CloudFlare → Browser
```

### Example 3: Google Cloud Deployment

```
Frontend:  https://qalnet.com (Cloud CDN)
Backend:   https://api.qalnet.com (Cloud Load Balancer)
Database:  CloudSQL PostgreSQL
Redis:     Cloud Memorystore

Configuration:
NEXT_PUBLIC_API_BASE_URL=https://api.qalnet.com
DATABASE_URL=postgresql://user:pass@cloudsql-ip:5432/qalnet
REDIS_URL=redis://memorystore-ip:6379
```

---

## Part 5: CORS & Security

### CORS Configuration

**Development:**
```bash
# Allow localhost for testing
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173
```

**Production:**
```bash
# Only allow your domain(s)
ALLOWED_ORIGINS=https://qalnet.com,https://admin.qalnet.com
```

### Security Headers

```
Access-Control-Allow-Origin: https://qalnet.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 3600
```

### Subdomain Strategy

**Production recommended structure:**
```
qalnet.com              → Main web frontend
www.qalnet.com          → Alias for main
api.qalnet.com          → Backend API
admin.qalnet.com        → Admin dashboard
docs.qalnet.com         → API documentation
cdn.qalnet.com          → Static assets CDN
status.qalnet.com       → Status page
```

---

## Part 6: Environment-Specific Deployment

### Using Docker Environment Variables

```dockerfile
FROM node:18-alpine

ENV NEXT_PUBLIC_API_BASE_URL=https://api.qalnet.com
ENV NEXT_PUBLIC_APP_URL=https://qalnet.com
ENV NODE_ENV=production

RUN npm run build
CMD ["npm", "start"]
```

### Using Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    image: qalnet-frontend:latest
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://backend:4000
      NEXT_PUBLIC_APP_URL: http://frontend:3001
      NODE_ENV: development
    ports:
      - "3001:3001"
    depends_on:
      - backend

  backend:
    image: qalnet-backend:latest
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/qalnet
      ALLOWED_ORIGINS: http://frontend:3001
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    ports:
      - "4000:4000"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: qalnet
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass

  redis:
    image: redis:7-alpine
```

### Using Kubernetes ConfigMaps

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: qalnet-config
data:
  NEXT_PUBLIC_API_BASE_URL: "https://api.qalnet.com"
  DATABASE_URL: "postgresql://user:pass@postgres.default.svc:5432/qalnet"
  ALLOWED_ORIGINS: "https://qalnet.com"

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: qalnet-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: qalnet-backend:latest
        envFrom:
        - configMapRef:
            name: qalnet-config
```

---

## Part 7: Multi-Tenant Configuration (Advanced)

If supporting multiple organizations:

```bash
# Dynamic domain routing
QALNET_TENANT_ID=qalnet-ethiopia
QALNET_API_BASE_URL=https://api.ethiopia.qalnet.io
QALNET_APP_URL=https://ethiopia.qalnet.io

# Multi-region deployment
REGION=us-east-1
DATACENTER=aws-us-east-1
FAILOVER_REGION=us-west-2
```

---

## Part 8: Troubleshooting

### Issue: CORS Error

**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution 1:** Check `ALLOWED_ORIGINS`
```bash
# Backend .env
ALLOWED_ORIGINS=https://your-domain.com

# Restart backend
npm run start:backend
```

**Solution 2:** Check `next.config.ts` rewrites
```typescript
// next.config.ts
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  console.log('Backend URL:', backendUrl); // Debug
  return [
    {
      source: '/api/:path*',
      destination: `${backendUrl}/api/:path*`,
    },
  ];
}
```

### Issue: API Endpoint Not Found

**Error:** `404 Not Found /api/v1/equbs`

**Check:**
1. Backend running on correct port?
   ```bash
   curl http://localhost:4000/api/v1/health
   ```

2. Frontend using correct API base URL?
   ```bash
   echo $NEXT_PUBLIC_API_BASE_URL
   ```

3. Next.js rewrite configured?
   ```bash
   npm run build  # Check build logs
   ```

### Issue: Webhook Not Received

**Check payment webhook URLs:**
```bash
# Chapa dashboard → Settings → Webhooks
Webhook URL: https://api.qalnet.com/api/v1/payments/webhook/chapa

# Telebirr dashboard → Settings → Webhooks
Webhook URL: https://api.qalnet.com/api/v1/payments/webhook/telebirr
```

---

## Part 9: Monitoring URLs

### Health Checks

```bash
# Backend health
curl https://api.qalnet.com/api/v1/health

# Database connection
curl https://api.qalnet.com/api/v1/admin/config/status

# API version
curl https://api.qalnet.com/api/v1/version
```

### Logs & Debugging

```bash
# Frontend logs (browser console)
console.log(process.env.NEXT_PUBLIC_API_BASE_URL)

# Backend logs
PM2_HOME=~/.pm2 pm2 logs qalnet-backend

# Docker logs
docker logs qalnet-backend
docker logs qalnet-frontend
```

---

## Part 10: Checklist

Before deploying to production:

- [ ] Frontend `.env.production` configured with real domain
- [ ] Backend `.env.production` configured with real URLs
- [ ] `ALLOWED_ORIGINS` includes only real domain(s)
- [ ] Payment gateway URLs configured (Chapa/Telebirr)
- [ ] Webhook URLs registered in payment dashboards
- [ ] Database connection tested
- [ ] Redis connection tested
- [ ] CORS test passed (`OPTIONS /api/v1/health`)
- [ ] SSL certificate valid (no mixed HTTP/HTTPS)
- [ ] DNS records point to correct IPs
- [ ] Load balancer health checks passing
- [ ] Database backups configured

---

## References

- Frontend: `apps/web/.env.example`
- Backend: `apps/backend/.env.example`
- Next.js Config: `apps/web/next.config.ts`
- API Service: `apps/web/src/app/services/api.ts`
- Docker: `docker-compose.yml`

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Configuration:** Environment-based, no hardcoded URLs
