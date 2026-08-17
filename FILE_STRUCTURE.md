# QalNet Monorepo — File Structure Documentation

This file provides a complete snapshot of the monorepo's file layout as of the current state. It serves as a reference for developers to navigate the codebase, understand module organization, and locate specific files quickly.

The structure is organized as follows:

- **apps/backend/** — NestJS API application (port 3000)
  - `database/` — SQL schemas and migration files
  - `scripts/` — Utility scripts (e.g., seed-admin)
  - `src/` — Source code organized by feature modules
    - `app.module.ts` — Root app module
    - `main.ts` — Application entry point
    - `common/` — Shared guards, decorators, interceptors, middleware
    - `config/` — Configuration files (database, vault)
    - `modules/` — Feature modules (auth, users, equbs, payments, notifications, sms, social, wallet)
      - Each module contains its controller, service, repository, and DTOs

- **apps/web/** — Next.js frontend application (port 3001)
  - `public/` — Static assets
  - `src/` — React/TypeScript source code
    - `app/` — App Router pages organized by feature (admin, complete-profile, architecture)
    - `components/` — Reusable UI components grouped by feature (auth, admin)

- **apps/backend/scripts/** — Dev/ops utilities
  - `seed-admin.cjs` — Script to seed admin user

- **packages/** (refer to README.md for shared types and typescript configs)

- **scripts/** (refer to README.md for root-level utilities)

- Config files: `.env.example`, `.env` (local, gitignored), `.gitignore`, `.prettierrc`, `turbo.json`, `package.json`, `nest-cli.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `tsconfig.build.json`

> **Environment Setup**: Copy example env files and fill in your values:
> ```bash
> # Backend
> copy apps\backend\.env.example apps\backend\.env
> 
> # Frontend
> copy apps\web\.env.example apps\web\.env.local
> ```
> 
> The backend also reads the monorepo root `.env` as a fallback for shared variables. Do not commit real secrets.

## Database & Security Configuration

### Database Setup

The backend uses SQL migrations managed via TypeScript. Database structure is defined in:

| File | Description |
|------|-------------|
| `apps/backend/database/schema.sql` | Main database schema definition |
| `apps/backend/database/migrations/` | Sequential migration files (001-009) |
| Current migrations add: refresh tokens, user name fields, wallet transactions, profile photos, user settings, efficiency indexes, membership approval, login lockout, and PIN reset codes |

**Environment Configuration**:

Database connection settings are managed via environment variables. Create local `.env` files by copying examples:

```bash
# Backend
copy apps\backend\.env.example apps\backend\.env

# Frontend
copy apps\web\.env.example apps\web\.env.local
```

The backend `config/database.config.ts` reads database connection from environment variables. Do not commit real credentials - `.env` files are gitignored.

### Security Configuration

**Vault & Secrets**:

| File | Purpose |
|------|---------|
| `apps/backend/config/vault.config.ts` | Vault/secrets management configuration |
| `.env.example` | Example environment variables (do not commit real values) |
| `.env` (local) | Local environment variables - gitignored |

**Security Links & Best Practices**:

- JWT keys are generated via `scripts/update-keys.cjs` - run from repo root to regenerate RSA key pair
- Row Level Security (RLS) context middleware: `apps/backend/src/common/middleware/rls-context.middleware.ts`
- Authentication guards: `jwt-auth.guard.ts`, `roles.guard.ts` in `apps/backend/src/common/guards/`
- Do not share `.env` files or commit them to version control
- Use the monorepo root `.env` as fallback for shared variables

**Security Scripts**:

| Script | Purpose |
|--------|---------|
| `scripts/update-keys.cjs` | Regenerate RSA JWT key pair in root `.env` |
| `scripts/db/dbcheck.cjs` | Check DB connectivity, tables, and record counts |

This documentation is generated from the actual file system and should be kept in sync when new files are added or removed.

---

## Visual File Structure Graph (ASCII Tree)

```
qalnet/
├── .env.example
├── .gitignore
├── .prettierrc
├── turbo.json
├── package.json
├── README.md
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── environments/
│   ├── apps/backend/.env.example
│   └── apps/web/.env.example
└── scripts/
    └── db/
        ├── dbcheck.cjs
        └── archive/
            ├── check-rls.cjs
            └── db-state.cjs

apps/
├── backend/
│   ├── nest-cli.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── database/
│   │   ├── schema.sql
│   │   └── migrations/
│   │       ├── 001_add_refresh_tokens.sql
│   │       ├── 002_add_user_name_fields.sql
│   │       ├── 003_add_wallet_transactions.sql
│   │       ├── 004_add_user_profile_photo.sql
│   │       ├── 005_add_user_settings.sql
│   │       ├── 006_add_efficiency_indexes.sql
│   │       ├── 007_add_membership_approval.sql
│   │       ├── 008_add_login_lockout.sql
│   │       └── 009_add_pin_reset_codes.sql
│   ├── scripts/
│   │   └── seed-admin.cjs
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       ├── common/
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts
│       │   │   └── roles.decorator.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   ├── jwt.strategy.ts
│       │   │   └── roles.guard.ts
│       │   ├── interceptors/
│       │   │   └── logging.interceptor.ts
│       │   └── middleware/
│       │       └── rls-context.middleware.ts
│       ├── config/
│       │   ├── database.config.ts
│       │   └── vault.config.ts
│       └── modules/
│           ├── auth/
│           │ ├── auth.module.ts
│           │ ├── auth.controller.ts
│           │ ├── auth.service.ts
│           │ ├── auth.repository.ts
│           │ └── dto/
│           │   ├── login.dto.ts
│           │   ├── register.dto.ts
│           │   ├── change-password.dto.ts
│           │   ├── refresh-token.dto.ts
│           │   ├── verify-otp.dto.ts
│           │   ├── verify-fayda.dto.ts
│           │   ├── send-otp.dto.ts
│           │   ├── reset-pin.dto.ts
│           │   ├── two-factor.dto.ts
│           │   ├── forgot-pin.dto.ts
│           │   ├── check-availability.dto.ts
│           │   └── reset-pin.dto.ts
│           ├── users/
│           │ ├── users.module.ts
│           │ ├── users.controller.ts
│           │ ├── users.service.ts
│           │ ├── users.repository.ts
│           │ └── dto/
│           │   ├── update-role.dto.ts
│           │   └── reset-pin.dto.ts
│           ├── equbs/
│           │ ├── equbs.module.ts
│           │ ├── equbs.controller.ts
│           │ ├── equbs.service.ts
│           │ └── equbs.repository.ts
│           ├── payments/
│           │ ├── payments.module.ts
│           │ ├── payments.controller.ts
│           │ ├── payments.service.ts
│           │ ├── payments.repository.ts
│           │ ├── dto/
│           │   ├── bid.dto.ts
│           │   ├── checkout.dto.ts
│           │   └── webhook.dto.ts
│           │ └── tasks/
│           │     └── debit.task.ts
│           ├── notifications/
│           │ ├── notifications.module.ts
│           │ ├── notifications.controller.ts
│           │ ├── notifications.service.ts
│           │ └── notifications.repository.ts
│           ├── sms/
│           │ ├── sms.module.ts
│           │ └── sms.service.ts
│           ├── social/
│           │ ├── social.module.ts
│           │ ├── social.controller.ts
│           │ ├── social.service.ts
│           │ ├── social.repository.ts
│           │ └── dto/
│           │   ├── create-proposal.dto.ts
│           │   └── cast-vote.dto.ts
│           └── wallet/
│               ├── wallet.module.ts
│               ├── wallet.controller.ts
│               ├── wallet.service.ts
│               └── wallet.repository.ts
│
└── web/
    ├── next.config.ts
    ├── package.json
    ├── eslint.config.mjs
    ├── postcss.config.mjs
    ├── .env.example
    ├── public/
    │   └── Qalnet.png
    └── src/
        ├── app/
        │   ├── admin/
        │   │   ├── layout.tsx
        │   │   └── page.tsx
        │   │   ├── approvals/
        │   │   │   └── page.tsx
        │   │   ├── customers/
        │   │   │   └── page.tsx
        │   │   ├── dashboard/
        │   │   │   └── page.tsx
        │   │   ├── finance/
        │   │   │   └── page.tsx
        │   │   ├── kyc/
        │   │   │   └── page.tsx
        │   │   └── member-access/
        │   │       └── page.tsx
        │   ├── complete-profile/
        │   │   └── page.tsx
        │   └── architecture/
        │       └── page.tsx
        └── components/
            ├── CountUpStats.tsx
            ├── DiagramRegistrationForm.tsx
            ├── EqubRotation.tsx
            ├── Footer.tsx
            ├── HeroAnimation.tsx
            ├── HowItWorks.tsx
            ├── PricingComparison.tsx
            ├── PromoBanner.tsx
            ├── PromoFeatures.tsx
            ├── RegistrationForm.tsx
            ├── SimpleRegistrationForm.tsx
            ├── Testimonials.tsx
            ├── AdminGate.tsx
            ├── AppShell.tsx
            ├── DashboardCharts.tsx
            ├── Sidebar.tsx
            ├── TopHeader.tsx
            ├── KpiCard.tsx
            ├── StatusBadge.tsx
            ├── components/
            │   ├── admin/
            │   │   ├── AdminGate.tsx
            │   │   ├── DashboardCharts.tsx
            │   │   ├── KpiCard.tsx
            │   │   ├── Sidebar.tsx
            │   │   └── TopHeader.tsx
            │   └── auth/
            │       ├── EqubCategoryCard.tsx
            │       └── EqubDetailModal.tsx
            ├── auth/
            │   ├── DetailsEntryStep.tsx
            │   ├── EqubSelectionStep.tsx
            │   ├── ForgotPinForm.tsx
            │   ├── ForgotPinFormRefactored.tsx
            │   ├── GuestOverview.tsx
            │   ├── GuestOverviewRefactored.tsx
            │   ├── LoginForm.tsx
            │   ├── OtpVerificationStep.tsx
            │   ├── PhoneVerificationStep.tsx
            │   ├── RegistrationForm.tsx
            │   └── RegistrationFormRefactored.tsx
            └── components/
                └── auth/
                    ├── EqubCategoryCard.tsx
                    └── EqubDetailModal.tsx
```

---

## Module-to-Feature Mapping Summary

| Backend Module | Frontend Counterpart | Key Connection |
|----------------|----------------------|----------------|
| `auth` | `LoginForm`, `OtpVerificationStep`, `RegistrationForm` | JWT auth guards + forms |
| `equbs` | `EqubRotation`, `EqubCategoryCard`, `EqubDetailModal` | Equb data visualization |
| `payments` | `PricingComparison`, `RegistrationForm` | Payment plans + checkout |
| `users` | Profile-related pages | User management |
| `social` | Testimonials, voting components | Social interactions |
| `notifications` | Alert/notification UI | Notification system |
| `sms` | Phone verification forms | SMS OTP verification |
| `wallet` | Dashboard KPI cards | Wallet/balance tracking |