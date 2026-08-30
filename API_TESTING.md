# QalNet API Testing Guide

This guide provides comprehensive information about testing the QalNet API endpoints.

## Quick Start

### Prerequisites
- Backend running on `http://localhost:4000`
- PostgreSQL database initialized
- Admin user seeded

### Run Automated Tests
```bash
.\scripts\test-api.ps1
```

---

## Core API Endpoints

### Base URL
```
http://localhost:4000/api/v1
```

### Documentation
- **Swagger/OpenAPI UI:** http://localhost:4000/api/docs
- **JSON Schema:** http://localhost:4000/api-json

---

## Authentication Endpoints

### 1. Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phone": "+251900000000",
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "phone": "+251900000000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "participant",
  "isActive": true,
  "createdAt": "2026-08-29T00:00:00Z"
}
```

**Test with curl:**
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+251900000000",
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 2. Login (PIN-based)
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "+251904556677",
  "pin": "4488"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "phone": "+251904556677",
    "email": "admin@qalnet.com",
    "role": "admin",
    "firstName": "Danel",
    "lastName": "Temesgen"
  }
}
```

### 3. Verify OTP (Phone Verification)
```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "phone": "+251900000000",
  "otp": "818959"
}
```

**Response (200):**
```json
{
  "verified": true,
  "message": "Phone verified successfully"
}
```

### 4. Check Phone Availability
```http
GET /api/v1/auth/check-availability?phone=%2B251900000000
```

**Response (200):**
```json
{
  "available": true,
  "phone": "+251900000000"
}
```

### 5. Change Password
```http
POST /api/v1/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

### 6. Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

---

## User Management Endpoints

### Get All Users (Admin only)
```http
GET /api/v1/users
Authorization: Bearer <accessToken>
```

### Get User Profile
```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

### Update User Profile
```http
PATCH /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "profilePhoto": "https://example.com/photo.jpg"
}
```

### Delete User (Admin)
```http
DELETE /api/v1/users/:userId
Authorization: Bearer <accessToken>
```

---

## Equb (Group) Endpoints

### Create Equb Group
```http
POST /api/v1/equbs
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "My Savings Group",
  "description": "Monthly savings rotation",
  "contributionAmount": 5000,
  "totalRounds": 12,
  "maxMembers": 10,
  "category": "general"
}
```

### Get All Equbs
```http
GET /api/v1/equbs
Authorization: Bearer <accessToken>
```

### Get Equb Details
```http
GET /api/v1/equbs/:equbId
Authorization: Bearer <accessToken>
```

### Join Equb
```http
POST /api/v1/equbs/:equbId/join
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "message": "I want to join this group"
}
```

### Update Equb (Host only)
```http
PATCH /api/v1/equbs/:equbId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "active",
  "maxMembers": 15
}
```

---

## Payment Endpoints

### Get Payments
```http
GET /api/v1/payments?equbId=uuid
Authorization: Bearer <accessToken>
```

### Make Payment
```http
POST /api/v1/payments/checkout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "equbId": "uuid",
  "amount": 5000,
  "paymentMethod": "chapa"
}
```

### Payment Webhook (Chapa)
```http
POST /api/v1/payments/webhook/chapa
Content-Type: application/json

{
  "reference": "unique-ref",
  "status": "success",
  "amount": 5000
}
```

---

## Wallet Endpoints

### Get Wallet Balance
```http
GET /api/v1/wallet
Authorization: Bearer <accessToken>
```

### Get Wallet Transactions
```http
GET /api/v1/wallet/transactions
Authorization: Bearer <accessToken>
```

### Withdraw Funds
```http
POST /api/v1/wallet/withdraw
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "amount": 10000,
  "phoneNumber": "+251900000000",
  "pin": "1234"
}
```

---

## Notification Endpoints

### Get Notifications
```http
GET /api/v1/notifications
Authorization: Bearer <accessToken>
```

### Mark as Read
```http
PATCH /api/v1/notifications/:notificationId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "isRead": true
}
```

### Delete Notification
```http
DELETE /api/v1/notifications/:notificationId
Authorization: Bearer <accessToken>
```

---

## Admin Endpoints

### Get Users Statistics
```http
GET /api/v1/admin/statistics/users
Authorization: Bearer <accessToken>
```

### Get Equbs Statistics
```http
GET /api/v1/admin/statistics/equbs
Authorization: Bearer <accessToken>
```

### Get Payments Statistics
```http
GET /api/v1/admin/statistics/payments
Authorization: Bearer <accessToken>
```

### Approve KYC
```http
POST /api/v1/admin/kyc/:userId/approve
Authorization: Bearer <accessToken>
```

### Reject KYC
```http
POST /api/v1/admin/kyc/:userId/reject
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "reason": "Documents unclear"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized - Invalid or missing token"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden - Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Error details..."
}
```

---

## Authentication

### Using Access Token
```bash
curl -H "Authorization: Bearer <accessToken>" \
  http://localhost:4000/api/v1/users/me
```

### Token Format
- **Type:** JWT (JSON Web Token)
- **Algorithm:** RS256 (RSA)
- **Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

- **Payload:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "participant",
  "iat": 1234567890,
  "exp": 1234571490
}
```

---

## Testing with Different Tools

### Using curl
```bash
# Basic request
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251904556677","pin":"4488"}'

# With token
curl -H "Authorization: Bearer token" \
  http://localhost:4000/api/v1/users/me

# With file body
curl -X POST http://localhost:4000/api/v1/equbs \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d @payload.json
```

### Using Postman
1. Import collection: `postman-collection.json` (if available)
2. Set variables:
   - `baseUrl`: `http://localhost:4000/api/v1`
   - `accessToken`: (from login response)
3. Test endpoints from collection

### Using Thunder Client (VS Code)
1. Create new request
2. Set URL: `http://localhost:4000/api/v1/endpoint`
3. Add headers and body
4. Send request

### Using REST Client (VS Code Extension)
Create `test.http` file:
```http
### Login
POST http://localhost:4000/api/v1/auth/login
Content-Type: application/json

{
  "phone": "+251904556677",
  "pin": "4488"
}

### Get User Profile
GET http://localhost:4000/api/v1/users/me
Authorization: Bearer {{accessToken}}
```

---

## Performance Testing

### Load Testing with Apache Bench
```bash
# Test 1000 requests with 10 concurrent
ab -n 1000 -c 10 http://localhost:4000/api/v1/health

# Test with headers
ab -n 1000 -c 10 \
  -H "Authorization: Bearer token" \
  http://localhost:4000/api/v1/users
```

### Load Testing with Artillery
```bash
npm install -g artillery

# Create test file
cat > load-test.yml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "User API"
    flow:
      - get:
          url: "/api/v1/health"

# Run test
artillery run load-test.yml
```

---

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:4000
```
**Solution:** Make sure backend is running with `npm run dev`

### Invalid Token
```
Error: Unauthorized - Invalid token
```
**Solution:** Refresh token with `/auth/refresh` endpoint

### CORS Error
```
Error: Access to XMLHttpRequest blocked by CORS policy
```
**Solution:** Check ALLOWED_ORIGINS in backend .env

### Database Connection
```
Error: Database connection failed
```
**Solution:** Initialize database with `node scripts/db/dbcheck.cjs`

---

## API Rate Limiting

- Default: 100 requests per 15 minutes
- Admin: 500 requests per 15 minutes
- Public endpoints: No limit

---

## Useful Scripts

```bash
# Test registration
node scripts/test-reg.cjs

# Check database
node scripts/db/dbcheck.cjs

# Seed admin user
node apps/backend/scripts/seed-admin.cjs

# Run API tests
.\scripts\test-api.ps1
```

---

## Next Steps

1. **Start services:** `npm run dev`
2. **Access API docs:** http://localhost:4000/api/docs
3. **Test endpoints:** Use provided curl examples
4. **Run automated tests:** `.\scripts\test-api.ps1`
5. **Monitor logs:** `npm run pm2:logs`

---

*Generated: 2026-08-29 | QalNet API Testing Documentation*
