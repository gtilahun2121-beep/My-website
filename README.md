# QalNet Monorepo

Digital Equb Platform — unified monorepo powered by [Turborepo](https://turbo.build).

## Structure

```
qalnet/
├── apps/
│   ├── backend/          # NestJS API (port 3000)
│   │   ├── src/          #   app.module, main, common/, config/, modules/
│   │   ├── database/     #   schema.sql + migrations/
│   │   └── scripts/      #   seed-admin.cjs
│   └── web/              # Next.js frontend (port 3001)
│       ├── src/app/      #   App Router pages, components/, services/, i18n/
│       └── public/       #   static assets
├── packages/
│   ├── shared-types/     #   Shared TypeScript types (DTOs, interfaces)
│   └── typescript-config/    #   Shared tsconfig bases
├── scripts/              # Dev/ops utilities (shared)
│   └── db/               #   Database diagnostics + archive
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites
- Node.js >= 20
- npm >= 10

### Install all dependencies
```bash
npm install
```

### Run all apps in dev mode (parallel)
```bash
npm run dev
```

> If you hit `localhost refused to connect` / `ERR_CONNECTION_REFUSED`
> or `EADDRINUSE`, an orphaned dev server is likely holding ports 3000/3001.
> Run `npm run dev:restart` once — it kills any process on those ports and
> starts everything fresh:

### Run a specific app
```bash
# Backend only
npm run dev --filter=@qalnet/backend

# Frontend only
npm run dev --filter=@qalnet/web
```

### Build / test / type-check
```bash
npm run build
npm run test
npm run type-check
```

## Apps

| App | Description | Port | Docs |
|-----|-------------|------|------|
| `@qalnet/backend` | NestJS REST API | 3000 | `/api/docs` (dev) |
| `@qalnet/web` | Next.js frontend | 3001 | — |

## Packages

| Package | Description |
|---------|-------------|
| `@qalnet/shared-types` | Shared DTOs and interfaces used by both apps |
| `@qalnet/typescript-config` | Shared `tsconfig` base configs |

## Environment Setup

Copy the example env files and fill in your values:

```bash
# Backend
copy apps\backend\.env.example apps\backend\.env

# Frontend
copy apps\web\.env.example apps\web\.env.local
```

The backend also reads the monorepo root `.env` as a fallback for shared
variables (see `apps/backend/src/main.ts`). Do not commit real secrets.

## Development Scripts

Root-level utilities live in `scripts/`:

| Script | Purpose |
|--------|---------|
| `start-ngrok.ps1` | Open an ngrok tunnel to the backend (port 3000) |
| `update-keys.cjs` | Regenerate RSA JWT key pair in the root `.env` |
| `test-reg.cjs` | Smoke-test `POST /api/v1/auth/register` locally |
| `db/dbcheck.cjs` | Check DB connectivity, tables, and record counts |
| `db/archive/` | Archived one-off diagnostics (check-rls, db-state) |

Run them from the repo root, e.g. `node scripts/db/dbcheck.cjs`.
