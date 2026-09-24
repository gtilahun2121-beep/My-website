# QalNet — System Architecture & Design Diagrams

**Document Version:** 1.0
**Status:** ✅ Aligned with current implementation
**Source of truth:** `apps/backend/src`, `apps/backend/database/schema.sql`, `docker-compose.yml`, `apps/web/src/app`

All diagrams are written in Mermaid. They render on GitHub, GitLab, and in VS Code
(Markdown Preview Mermaid Support). A floating diagram-figure (`architecture/page.tsx`)
also exists in the app at `http://localhost:3001/architecture`.

---

## 1. System Context Diagram (C4 — Level 1)

Shows the system boundary and the external actors/services it talks to.

```mermaid
flowchart LR
    subgraph Actors
        P[Participant<br/>mobile app / browser]
        H[Equb Host / Dagna]
        A[Platform Admin]
    end

    subgraph QalNet["QALNET SYSTEM"]
        WEB["🌐 Web Frontend<br/>Next.js · :3001"]
        API["⚙️ Backend API<br/>NestJS · :4000"]
        DB[("🐘 PostgreSQL<br/>Neon / Neon Serverless v18")]
        REDIS[("🗄️ Redis<br/>cache + Redlock")]
    end

    PCH["💳 Chapa / Telebirr<br/>payment gateways"]
    SMS["✉️ SMS provider<br/>EthioSMS / Twilio"]
    EMAIL["📧 SendGrid / SMTP"]
    TG["💬 Telegram"]
    AWS["☁️ AWS Secrets Manager + S3"]
    VAULT["🔐 Secrets Vault"]

    P -->|HTTPS| WEB
    H -->|HTTPS| WEB
    A -->|HTTPS| WEB
    WEB -->|REST /api/v1| API
    API --> DB
    API --> REDIS
    API -->|"init / secrets"| VAULT
    VAULT --> AWS
    API -->|"deposit / verify / webhook"| PCH
    API -->|"disburse payout"| PCH
    API -->|notifications| SMS
    API -->|notifications| EMAIL
    API -->|notifications| TG
    API --> S3["🗄️ AWS S3<br/>profile photos / draw SVG"]
```

---

## 2. Container / Component Diagram (C4 — Level 2)

The monorepo is a Turborepo workspace; both apps share types and config packages.

```mermaid
flowchart TB
    subgraph Repo["QalNet Monorepo (Turborepo)"]
        subgraph WebApp["apps/web — Next.js Frontend (App Router)"]
            PAGES["Pages: auth, dashboard, create-equb,<br/>join-equb, my-equbs, wallet, admin, profile"]
            COMP["components/ (role-aware UI)"]
            CTX["context/ AuthContext · role checks"]
            SVC["services/ API client"]
            I18N["i18n/ localization"]
            ACP["architecture/ diagram page"]
        end

        subgraph Backend["apps/backend — NestJS REST API"]
            COMMON["common/ guards · interceptors · database"]
            MODULES["modules/ (13 feature modules)"]
            CONFIG["config/ database · email · vault"]
            SCHED["@nestjs/schedule cron jobs"]
        end

        PACKAGES["packages/shared-types<br/>packages/typescript-config<br/>(shared DTOs & tsconfig bases)"]
    end

    PAGES --> COMP
    PAGES --> CTX
    COMP --> SVC
    SVC -->|"fetch /api/v1"| MODULES
    MODULES --> COMMON
    MODULES --> SCHED
    COMMON --> CONFIG
    Backend --> PACKAGES
    WebApp --> PACKAGES
```

### Backend module decomposition

```mermaid
flowchart LR
    subgraph Modules["NestJS Feature Modules"]
        AUTH["auth<br/>JWT · PIN · refresh · 2FA"]
        USERS["users<br/>profile · KYC · trust score"]
        WALLET["wallet<br/>balances · transactions"]
        EQUBS["equbs<br/>groups · membership · bids"]
        PAY["payments<br/>deposit · verify · lottery"]
        PAYOUT["payouts<br/>disburse · batch · multisig"]
        DC["daily-cycle<br/>daily cutoff · penalties"]
        WC["weekly-cycle<br/>weekly cutoff"]
        RECON["reconciliation<br/>tickets · disputes"]
        NOTIF["notifications<br/>SMS · email · Telegram"]
        SMS["sms<br/>provider adapter"]
        SOCIAL["social<br/>proposals · votes · slot trades"]
        HEALTH["health<br/>liveness / readiness"]
    end

    AUTH --> USERS
    USERS --> WALLET
    EQUBS --> PAYMENTS
    PAY --> PAYOUT
    PAY --> RECON
    DC --> PAY
    WC --> PAY
    NOTIF --> SMS
    SOCIAL --> EQUBS
```

---

## 3. Database ERD (Core Domain)

Condensed from `apps/backend/database/schema.sql` + migrations. Core financial
entities on the left, support/analytics on the right.

```mermaid
erDiagram
    USERS ||--o| CREDIT_SCORES : "has trust"
    USERS ||--o| WALLETS : "owns"
    USERS ||--|| USER_SETTINGS : "prefs/2FA"
    USERS ||--o| REFRESH_TOKENS : "sessions"
    USERS ||--o{ MEMBERSHIPS : "joins"
    USERS ||--o{ PAYMENTS : "pays"
    USERS ||--o{ PAYOUTS : "wins"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ RECONCILIATION_TICKETS : "raises"
    USERS ||--o{ KYC_VERIFICATIONS : "proves"

    EQUB_GROUPS ||--o{ MEMBERSHIPS : "has"
    EQUB_GROUPS ||--o{ PAYMENTS : "collects"
    EQUB_GROUPS ||--o{ PAYOUTS : "disburses"
    EQUB_GROUPS ||--o{ LOTTERY_DRAWS : "draws"
    EQUB_GROUPS ||--o{ SOCIAL_PROPOSALS : "governs"
    EQUB_GROUPS ||--o{ PAYOUT_SLOT_TRADES : "trades slots"
    EQUB_GROUPS ||--o{ DAILY_CYCLES : "runs daily"
    EQUB_GROUPS ||--o{ WEEKLY_CYCLES : "runs weekly"

    PAYMENTS ||--o| PAYOUTS : "settles"
    PAYOUTS ||--o{ MULTISIG_APPROVALS : "approves"
    PAYOUTS ||--o{ PAYOUT_BATCHES : "batches"
    FEE_CONFIG ||--o{ PAYMENTS : "applies fees"

    SOCIAL_PROPOSALS ||--o{ SOCIAL_VOTES : "voted by"
    RECONCILIATION_TICKETS ||--o| PAYMENTS : "refers to"
    CRB_BLACKLISTS ||--o| USERS : "flags"

    USERS {
        uuid id PK
        varchar phone UK
        varchar email UK
        varchar telegram_handle UK
        user_role role
        bytea fayda_id "encrypted at app level"
        boolean is_active
    }
    EQUB_GROUPS {
        uuid id PK
        uuid host_id FK
        varchar name
        numeric total_amount
        numeric contribution_amount
        int cycle_days
        int total_rounds
        equb_status status
        numeric social_fund_balance
    }
    MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid equb_id FK
        text auto_debit_token
    }
    PAYMENTS {
        uuid id PK
        uuid user_id FK
        uuid equb_id FK
        int round_number
        numeric amount
        numeric fee_deducted
        payment_status payment_status
        varchar transaction_reference UK
    }
    PAYOUTS {
        uuid id PK
        uuid equb_id FK
        int round_number
        uuid winner_id FK
        numeric total_pot_amount
        payout_status status
    }
    WALLETS {
        uuid id PK
        uuid user_id FK
        numeric balance
        varchar currency
    }
    LOTTERY_DRAWS {
        uuid id PK
        uuid equb_id FK
        int round_number
        uuid winner_id FK
        text svg_canvas_data
        boolean is_purged
    }
```

---

## 4. Authentication & Authorization Flow (Sequence)

PIN/phone login → JWT (RSA-2048) + rotating refresh token (httpOnly cookie) →
role-based guards at API layer & Row-Level Security at DB layer.

```mermaid
sequenceDiagram
    actor U as Participant
    participant W as Next.js (Web)
    participant API as NestJS API
    participant G as JwtAuthGuard + RolesGuard
    participant DB as PostgreSQL (RLS)

    U->>W: Enter phone + PIN
    W->>API: POST /api/v1/auth/login
    API->>DB: verify PIN hash + lockout check
    DB-->>API: user row (id, role)
    API->>G: issue JWT access (RSA signed) + refresh token
    API-->>W: access token + set httpOnly refresh cookie
    W->>API: GET /api/v1/equbs (Bearer JWT)
    API->>G: validate signature + expiry
    G-->>API: payload {sub, role}
    API->>DB: query with app.current_user_id/role session vars
    DB->>DB: RLS policy checks row visibility
    DB-->>API: rows (scoped to user/admin)
    API-->>W: 200 JSON
    Note over API,DB: @Roles('host','admin') rejects participant with 403 via RolesGuard
```

---

## 5. Equb Lifecycle State Diagram

```mermaid
stateDiagram-v2
    [*] --> open : Host creates pool<br/>(POST /equbs)
    open --> active : Minimum members + 1st round opens
    active --> completed : last_round == total_rounds
    active --> cancelled : Host/admin cancels
    open --> cancelled : no members / host cancels
    completed --> [*]
    cancelled --> [*]

    state active {
        [*] --> collecting : cycle window opens<br/>(daily / weekly)
        collecting --> drawn : cutoff reached + eligible payers
        collecting --> collecting : members deposit / auto-debit
        collecting --> stalled : nobody paid (round retained)
        stalled --> collecting : next window retries same round
        drawn --> payout_tx : admin queues payout
        payout_tx --> paid_out : provider confirms disbursement
        paid_out --> collecting : next round begins
        payout_tx --> manual_review : missing details / provider error
        manual_review --> payout_tx : admin resolves & retries
    }
```

---

## 6. Daily / Weekly Cycle Engine (Sequence)

Triggered by cron (`DailyCycleTask` / `WeeklyCycleTask`) at each equb's cutoff.

```mermaid
sequenceDiagram
    participant Cron as @nestjs/schedule Task
    participant SVC as CycleService
    participant DB as PostgreSQL
    participant PAY as PaymentsService (lottery)
    participant NOTIF as Notifications

    Cron->>SVC: runAllDailyCutoffs()
    loop every active daily equb
        SVC->>DB: listActiveDailyEqubs()
        SVC->>SVC: isCycleDue(equb)? (time >= cutoff)
        SVC->>DB: open/close today's cycle row
        SVC->>DB: find approved members with unpaid contribution
        alt unpaid members exist
            SVC->>DB: insert penalty + debit wallet (admin RLS ctx)
            SVC->>NOTIF: notify late member (SMS/email/telegram)
        end
        alt ≥1 member paid
            SVC->>PAY: runLotteryDraw(equbId, round)
            PAY->>DB: CSPRNG select winner → lottery_draws + lottery_events
            PAY-->>SVC: draw event
            SVC->>DB: mark cycle drawn + open next day window
        else nobody paid
            SVC->>DB: skip draw, KEEP round, open next window
            Note over SVC: round intentionally not advanced,<br/>next day retries same round
        end
    end
```

---

## 7. Deposit / Payment Flow (Sequence)

```mermaid
sequenceDiagram
    actor U as Member
    participant W as Web
    participant API as PaymentsController
    participant V as VerifyService
    participant GATE as Chapa / Telebirr
    participant DB as PostgreSQL
    participant WAL as Wallet Service

    U->>W: Choose equb, contribution amount
    W->>API: POST /api/v1/payments/deposit
    API->>API: fee split resolved from active fee_config
    API->>GATE: create checkout / initialize payment
    GATE-->>U: redirect to checkout page
    U->>GATE: authorize + pay
    GATE->>API: webhook (signed with webhook secret)
    API->>V: verify signature + reference idempotency
    API->>DB: mark payment paid + set transaction_reference, paid_at
    API->>WAL: credit wallet / record wallet_transactions
    API-->>W: 200 confirmed
    Note over API,DB: Double-payment trigger + UNIQUE reference<br/>prevent duplicate settlement (reconciliation safety)
```

Payout disbursement follows the same provider confirmation rule:
`pending → queued → processing → success | failed → retry | manual_review`.

```mermaid
stateDiagram-v2
    [*] --> pending : draw completes
    pending --> queued : admin queues (POST /admin/payouts/process)
    queued --> processing : processor picks up
    processing --> success : provider confirms (reference returned)
    processing --> failed : provider rejects / no confirmation
    failed --> queued : auto retry
    failed --> manual_review : holds for human (missing winner details)
    queued --> manual_review : admin hold
    manual_review --> queued : admin resolves & retries
    success --> [*]
```

Large pots (≥ 1M ETB) additionally require `multisig_approvals` before dispatch.

---

## 8. Deployment Architecture (Docker Compose)

```mermaid
flowchart TB
    INET["Internet"]

    subgraph Host["Docker Host / VPS"]
        subgraph Net["qalnet network"]
            WEB["web — Next.js :3001"]
            API["backend — NestJS :4000"]
            POSTGRES[("postgres:18-alpine :5432<br/>schema + migrations auto-applied")]
            REDIS[("redis:7-alpine :6379<br/>AOF persistence")]
            SEED["seed — one-shot admin bootstrap<br/>(service_completed_successfully)"]
        end
        VOL1[("postgres_data volume")]
        VOL2[("redis_data volume")]
        POSTGRES --- VOL1
        REDIS --- VOL2
    end

    INET --> WEB
    INET --> API
    API --> POSTGRES
    API --> REDIS
    API --> VGATE["Chapa / Telebirr API"]
    WEB --> API
    SEED --> POSTGRES
```

- Run: `docker compose up -d --build`; lite infra only: `docker compose -f docker-compose-lite.yml up -d`.
- On fresh volume: `schema.sql` runs first, then `.sql` in `migrations/` in numeric order.
- Non-Docker production: **PM2** (`npm run pm2:start`) auto-restarts both apps; logs in `~/.pm2/logs`.

---

## 9. Use-Case Diagram (RBAC)

Three-tier roles: `participant`, `host` (Dagna), `admin`. Guards + RLS enforce
the boundaries. Direct equb creation is admin-only; hosts/members request equbs.

```mermaid
flowchart LR
    subgraph System["QalNet Platform"]
        UC1["Authenticate (phone + PIN / Fayda)"]
        UC2["Deposit contribution"]
        UC3["View active pools"]
        UC4["View trust score"]
        UC5["Request Equb Creation<br/>(admin approves)"]
        UC6["Activate Equb Pool (round 1)"]
        UC7["Trigger lottery draw"]
        UC8["Invite / remove members"]
        UC9["Queue / process payouts"]
        UC10["Run daily / weekly cycle"]
        UC11["Create Equb directly"]
        UC12["Approve / reject equb & membership requests"]
        UC13["Monitor system audits"]
        UC14["Manage users / KYC / roles"]
    end

    P["Participant"] --- UC1
    P --- UC2
    P --- UC3
    P --- UC4
    P --- UC5

    H["Host / Dagna"] --- UC6
    H --- UC7
    H --- UC8
    H --- UC9
    H --- UC10
    H -. "extends" .-> UC2
    H -. "extends" .-> UC4
    H -. "extends" .-> UC5

    A["Admin"] --- UC11
    A --- UC12
    A --- UC13
    A --- UC14
    A -. "extends" .-> UC6
    A -. "extends" .-> UC9
    A -. "extends" .-> UC5
```

---

## 10. Security & Data Isolation Context

Defense in depth across three layers (API guard → DB RLS → UI rendering).

```mermaid
flowchart LR
    REQ["Request (Bearer JWT)"]
    subgraph API_LAYER["API Layer"]
        JG[JwtAuthGuard<br/>RSA-2048 signature + expiry]
        RG[RolesGuard<br/>@Roles('participant','host','admin')]
        VP[ValidationPipe<br/>whitelist + DTO transform]
        RL[Rate limiting<br/>general/auth/payment]
    end
    subgraph DB_LAYER["Database Layer"]
        CTX["app.current_user_id / role<br/>session context"]
        RLS[RLS policies<br/>user_isolation · wallet · payment]
        AUD[audit_logs triggers<br/>INSERT/UPDATE/DELETE]
    end
    subgraph UI_LAYER["Frontend Layer"]
        HASH[AuthContext hasRole/can* checks]
        PROTECT[Protected routes + conditional render]
    end

    REQ --> JG --> RG --> VP --> RL
    RL --> CTX --> RLS --> AUD
    RL --> UI_LAYER
```

- **Passwords:** Argon2 with pepper. **PIN:** 4–6 digits, lockout after failed attempts (`008`).
- JWTs signed with **2048-bit RSA**; refresh tokens stored as hashes and rotated.
- `fayda_id` is encrypted at the application level (`pgp_sym_encrypt`).
- Fees: `fee_config` enforces `host_rate + admin_rate = total_rate` via CHECK constraint.
- **Financial integrity:** payments use a UNIQUE `transaction_reference` with a success CHECK
  constraint; payouts only reach `success` after provider confirmation.

---

## References

| Doc | Location |
|-----|----------|
| Code structure | `FILE_STRUCTURE.md` |
| Functional requirements | backend modules in `apps/backend/src/modules/` |
| Roles & RBAC | `ROLE_BASED_RESPONSIBILITIES.md` |
| Database DDL + RLS | `apps/backend/database/schema.sql` + `migrations/` |
| Env / integrations | `.env.example`, `PAYMENT_CONFIGURATION.md` |
| Deployment | `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `docker-compose.yml` |