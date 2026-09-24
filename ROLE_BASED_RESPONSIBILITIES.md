# QalNet Role-Based Responsibilities (RBAC)

**Document Version:** 2.1  
**Date:** September 24, 2026  
**Status:** ✅ Implemented, Documented & Aligned with Code

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
  - ✅ Request Equb Creation (admin approves)

### 2. EQUB HOST / DAGNA
- **Database Enum:** `'host'`
- **Description:** Users who host and operate their own equb pools
- **Use Cases:**
  - ✅ Activate Equb Pool (start round 1)
  - ✅ Trigger Lottery Draw
  - ✅ Invite & Remove Members
  - ✅ Queue / Process Payouts
  - ✅ Run Daily/Weekly Cycle
  - ✅ Submit Discount Bids
  - (Extends all participant capabilities)

### 3. ADMIN
- **Database Enum:** `'admin'`
- **Description:** System administrators with platform-wide governance
- **Use Cases:**
  - ✅ Create Equb Pool (direct)
  - ✅ Approve / Reject Equb & Membership Requests
  - ✅ Monitor System Audits
  - ✅ Process Payouts
  - ✅ Manage Users (roles, KYC, activation)
  - ✅ Manage Fee Configuration
  - (Extends all other capabilities)

---

## Responsibility Matrix

| Use Case | Participant | Host | Admin |
|----------|-------------|------|-------|
| Deposit Contribution | ✅ | ✅ | ✅ |
| View Trust Score | ✅ | ✅ | ✅ |
| View Active Pools | ✅ | ✅ | ✅ |
| Authenticate via Fayda | ✅ | ✅ | ✅ |
| Request Equb Creation | ✅ | ✅ | ✅ |
| Create Equb Pool (direct) | ❌ | ❌ | ✅ |
| Activate Equb Pool | ❌ | ✅ | ✅ |
| Trigger Lottery Draw | ❌ | ✅ | ✅ |
| Invite / Remove Members | ❌ | ✅ | ✅ |
| Queue / Process Payouts | ❌ | ✅ | ✅ |
| Run Daily/Weekly Cycle | ❌ | ✅ | ✅ |
| Approve / Reject Equb & Membership Requests | ❌ | ❌ | ✅ |
| Monitor System Audits | ❌ | ❌ | ✅ |
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
- `POST /api/v1/payments/initiate` - Make equb contribution
- `POST /api/v1/equbs/requests` - Request that an admin creates an equb
- `GET /api/v1/users/trust-score` - View credibility score
- `GET /api/v1/equbs` - Browse available equbs
- `POST /api/v1/auth/login/fayda` - Authenticate

**Host Endpoints:**
- `POST /api/v1/equbs/:id/activate` - Start round 1 (@Roles('host', 'admin'))
- `POST /api/v1/equbs/:id/draws` - Trigger draw (@Roles('host', 'admin'))
- `POST /api/v1/equbs/:id/members/invite` - Invite members (@Roles('host', 'admin'))
- `DELETE /api/v1/equbs/:id/members/:memberId` - Remove member (@Roles('host', 'admin'))
- `POST /api/v1/payouts/process` - Process payouts (@Roles('host', 'admin'))
- `POST /api/v1/daily-cycles/:id/run` - Run cycle (@Roles('host', 'admin'))

**Admin Endpoints:**
- `POST /api/v1/equbs` - Create equb directly (@Roles('admin'))
- `POST /api/v1/admin/equb-requests/:id/approve` - Approve equb request (@Roles('admin'))
- `POST /api/v1/admin/memberships/:id/approve` - Approve membership (@Roles('admin'))
- `GET /api/v1/admin/system-logs` - View audit logs (@Roles('admin'))
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
const { user, hasRole } = useAuth();

// Check multiple roles
if (hasRole(['host', 'admin'])) {
  // Show host features (activate equb, run draws, manage members)
}

// Show the "request equb" form to any authenticated user
if (user) {
  // Show request button (admin approves later)
}
```

### Protected Routes
- Admin routes check `hasRole('admin')`
- Host routes check `hasRole(['host', 'admin'])`
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
    ↓ (Admin promotes — hosts operate equb pools)
    ↓
  HOST (Activates equbs, runs draws, manages members & payouts)
    ↓ (Admin decision)
    ↓
  ADMIN (Full platform governance)
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
# Test participant cannot create equb directly (admin-only endpoint)
curl -X POST http://localhost:4000/api/v1/equbs \
  -H "Authorization: Bearer <participant-token>"
# Expected: 403 Forbidden

# Test participant CAN request an equb (admin decides)
curl -X POST http://localhost:4000/api/v1/equbs/requests \
  -H "Authorization: Bearer <participant-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Team Savings","contribution_amount":500}'
# Expected: 201 Created

# Test host can activate an equb they host
curl -X POST http://localhost:4000/api/v1/equbs/<id>/activate \
  -H "Authorization: Bearer <host-token>"
# Expected: 200 OK

# Test admin can manage users
curl -X PATCH http://localhost:4000/api/v1/admin/users/:id/role \
  -H "Authorization: Bearer <admin-token>"
# Expected: 200 OK
```

---

## Compliance Checklist

- ✅ Three roles clearly defined (participant, host, admin)
- ✅ Use cases mapped from diagram to current implementation
- ✅ Direct equb creation is admin-only; members/hosts submit requests
- ✅ Host operates only within their own equb pools
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
