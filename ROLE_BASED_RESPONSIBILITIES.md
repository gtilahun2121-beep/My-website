# QalNet Role-Based Responsibilities (RBAC)

**Document Version:** 2.0  
**Date:** September 22, 2026  
**Status:** ✅ Implemented & Documented

---

## Overview

QalNet implements a **three-tier Role-Based Access Control (RBAC)** system based on the use case diagram provided. This document serves as the source of truth for role responsibilities and permissions.

## Three Core Roles

### 1. PARTICIPANT (Default Role)
- **Database Enum:** `'participant'`
- **Description:** Regular users who join equbs and contribute savings
- **Use Cases:**
  - ✅ Deposit Contribution
  - ✅ View Trust Score
  - ✅ View Active Pools
  - ✅ Authenticate via Fayda

### 2. EQUB HOST / DAGNA
- **Database Enum:** `'host'`
- **Description:** Users who create and manage equb pools
- **Use Cases:**
  - ✅ Create Equb Pool
  - ✅ Trigger Lottery Draw
  - ✅ Verify Payments
  - (Extends all participant capabilities)

### 3. ADMIN
- **Database Enum:** `'admin'`
- **Description:** System administrators with platform oversight
- **Use Cases:**
  - ✅ Monitor System Audits
  - ✅ Process Payouts
  - ✅ Manage Users
  - (Extends all other capabilities)

---

## Responsibility Matrix

| Use Case | Participant | Host | Admin |
|----------|-------------|------|-------|
| Deposit Contribution | ✅ | ✅ | ✅ |
| View Trust Score | ✅ | ✅ | ✅ |
| View Active Pools | ✅ | ✅ | ✅ |
| Authenticate via Fayda | ✅ | ✅ | ✅ |
| Create Equb Pool | ❌ | ✅ | ✅ |
| Trigger Lottery Draw | ❌ | ✅ | ✅ |
| Verify Payments | ❌ | ✅ | ✅ |
| Monitor System Audits | ❌ | ❌ | ✅ |
| Process Payouts | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |

---

## API Implementation

### Guard Decorators
```typescript
@UseGuards(JwtAuthGuard)              // Authentication required
@UseGuards(JwtAuthGuard, RolesGuard)  // Authentication + Role check
@Roles('host', 'admin')               // Only these roles allowed
```

### Key Endpoints by Role

**Participant Endpoints:**
- `POST /api/v1/payments/deposit` - Make equb contribution
- `GET /api/v1/users/trust-score` - View credibility score
- `GET /api/v1/equbs` - Browse available equbs
- `POST /api/v1/auth/login/fayda` - Authenticate

**Host Endpoints:**
- `POST /api/v1/equbs` - Create equb (@Roles('host', 'admin'))
- `POST /api/v1/daily-cycles/:id/run` - Trigger draw (@Roles('host', 'admin'))
- `PATCH /api/v1/payments/:id/verify` - Verify payment (@Roles('host', 'admin'))

**Admin Endpoints:**
- `GET /api/v1/admin/system-logs` - View audit logs (@Roles('admin'))
- `POST /api/v1/admin/payouts/process` - Process payouts (@Roles('admin'))
- `PATCH /api/v1/admin/users/:id/role` - Manage roles (@Roles('admin'))
- `PATCH /api/v1/admin/users/:id/kyc` - Verify KYC (@Roles('admin'))

---

## Database-Level Security

All tables protected with Row-Level Security (RLS) policies:

```sql
-- Participants see only their own data
WHERE user_id = current_user_id() OR current_user_role() = 'admin'

-- Hosts see their equbs and members
WHERE host_id = current_user_id() OR current_user_role() = 'admin'

-- Admins see all data
WHERE current_user_role() = 'admin'
```

---

## Frontend Implementation

### Auth Context with Role Checking
```typescript
const { user, hasRole, canCreateEqub, canManageUsers } = useAuth();

// Check multiple roles
if (hasRole(['host', 'admin'])) {
  // Show host features
}

// Check specific capability
if (canCreateEqub()) {
  // Show create button
}
```

### Protected Routes
- Admin routes check `canManageUsers()`
- Host routes check `canCreateEqub()`
- All routes check `isAuthenticated`

---

## Security Layers

1. **API Layer:** Guards and Decorators
   - `JwtAuthGuard` validates token
   - `RolesGuard` validates role permission
   - `@Roles()` decorator specifies allowed roles

2. **Database Layer:** RLS Policies
   - Session variables set user context
   - Policies enforce row-level isolation
   - No data leakage between users/hosts

3. **Frontend Layer:** Conditional Rendering
   - `hasRole()` checks before showing features
   - Protected pages redirect unauthorized users
   - Audit trails on sensitive actions

4. **Audit Layer:** Comprehensive Logging
   - All admin actions logged
   - Timestamp and actor tracked
   - System events monitored

---

## Role Promotion Path

```
PARTICIPANT
    ↓ (Admin request or system threshold)
    ↓
  HOST (Can create equbs, manage members)
    ↓ (Admin decision)
    ↓
  ADMIN (Full platform access)
```

---

## Implementation Files

**Backend:**
- `apps/backend/src/common/guards/roles.guard.ts` - Role enforcement
- `apps/backend/src/common/decorators/roles.decorator.ts` - Role metadata
- `apps/backend/src/modules/*/admin.controller.ts` - Admin endpoints
- `apps/backend/database/schema.sql` - RLS policies

**Frontend:**
- `apps/web/src/app/context/AuthContext.tsx` - Role utilities
- `apps/web/src/app/admin/` - Admin pages (protected)
- `apps/web/src/app/components/` - Role-aware components

**Database:**
- `CREATE TYPE user_role AS ENUM ('participant', 'host', 'admin')`
- RLS policies on users, wallets, equbs, payments tables

---

## Testing Roles

```bash
# Test participant cannot create equb
curl -X POST http://localhost:4000/api/v1/equbs \
  -H "Authorization: Bearer <participant-token>"
# Expected: 403 Forbidden

# Test host can create equb
curl -X POST http://localhost:4000/api/v1/equbs \
  -H "Authorization: Bearer <host-token>"
# Expected: 201 Created

# Test admin can manage users
curl -X PATCH http://localhost:4000/api/v1/admin/users/:id/role \
  -H "Authorization: Bearer <admin-token>"
# Expected: 200 OK
```

---

## Compliance Checklist

- ✅ Three roles clearly defined (participant, host, admin)
- ✅ Use cases mapped from diagram to implementation
- ✅ API guards enforce role permissions
- ✅ Database RLS policies isolate data
- ✅ Frontend respects role boundaries
- ✅ Audit logging tracks admin actions
- ✅ Role promotion path documented
- ✅ All code follows RBAC patterns
- ✅ Tests verify role enforcement
- ✅ Documentation complete

---

## References

- **Use Case Diagram:** Provided in project
- **API Documentation:** `/api/v1/docs`
- **Database Schema:** `apps/backend/database/schema.sql`
- **Type Definitions:** `packages/shared-types/src/common.ts`
- **Implementation Guide:** `RBAC_IMPLEMENTATION.md` (in artifacts)

---

**Last Updated:** September 22, 2026  
**Status:** ✅ Production Ready
