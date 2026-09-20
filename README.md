# QalNet Monorepo

Digital Equb Platform — unified monorepo powered by [Turborepo](https://turbo.build).

## Structure

```
qalnet/
├── apps/
│   ├── backend/          # NestJS API (port 4000)
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

### npm install keeps failing on Windows (EPERM / ECONNRESET)?
The classic Windows failures are fixed by the built-in helper:

```bash
npm run clean:install        # safe: kills none of your processes
npm run clean:install -- --kill   # also force-kills all node.exe (dev servers)
```

It stops orphaned node processes, re-deletes `node_modules` with retries,
cleans the corrupt npm cache, then reinstalls with fetch retries (configured
in `.npmrc`). If `--kill` still cannot delete `node_modules`, close:

- your terminal / editor / File Explorer if their current folder is inside `node_modules`
- then exclude the repo folder from Windows Defender/antivirus real-time scans

### Run all apps in dev mode (parallel)
```bash
npm run dev
```

> If you hit `localhost refused to connect` / `ERR_CONNECTION_REFUSED`
> or `EADDRINUSE`, an orphaned dev server is likely holding ports 4000/3001.
> Run `npm run dev:restart` once — it kills any process on those ports and
> starts everything fresh:

### Run a specific app
```bash
# Backend only
npm run dev --filter=@qalnet/backend

# Frontend only
npm run dev --filter=@qalnet/web
```

### Run apps permanently (PM2 — recommended)
If the API / localhost keeps dying after some hours, run the production
bundles under PM2 instead. PM2 auto-restarts any crashed process, so a
Neon blip, Windows sleep, or orphaned port no longer takes the site down:

```bash
npm run pm2:start     # build once, then start + persist both apps
npm run pm2:status    # check health (online / restarts / uptime)
npm run pm2:logs      # tail live logs
npm run pm2:restart   # restart both apps after a code pull
npm run pm2:stop      # stop both apps
```

- `qalnet-backend` runs `apps/backend/dist/.../main.js` on :4000
  (reads `apps/backend/.env`, same as dev).
- `qalnet-web` runs `next start` on :3001 (requires a `next build` —
  `npm run pm2:start` does this automatically).
- Logs live in `C:\Users\<you>\.pm2\logs\`.
- To auto-start after a Windows reboot, run `npx pm2 startup` once from an
  **admin** terminal (on Windows this needs the
  `pm2-windows-startup` npm package or Task Scheduler entry).

### Build / test / type-check
```bash
npm run build
npm run test
npm run type-check
```

## Run everything with Docker (recommended for live / full-stack)

One command builds the backend + web images and brings up the whole stack
(PostgreSQL with the schema + migrations, Redis, the NestJS API, and the
Next.js frontend):

```bash
docker compose up -d --build
```

| Service    | URL / port        | Notes |
|-----------|-------------------|-------|
| Web app   | http://localhost:3001 | Next.js frontend |
| Backend   | http://localhost:4000 | NestJS REST API |
| API docs  | http://localhost:4000/api/v1/health | Health endpoint |
| PostgreSQL | :5432 (`postgres` / `postgres`, db `qalnet_dev`) | Schema + migrations applied on a fresh volume |
| Redis     | :6379                | Cache / Redlock |

On the very first boot, the Postgres container applies
`apps/backend/database/schema.sql` and then every `.sql` inside
`apps/backend/database/migrations/` (in numeric order) automatically — you
don't need to run any migration step by hand.

Only infrastructure (DB + Redis, no app images) is started by:

```bash
docker compose -f docker-compose-lite.yml up -d
```

Troubleshooting:
- `docker compose config` validates the file without needing the daemon.
- Wipe everything (including the DB data volume) with `docker compose down -v`.
- Live logs: `docker compose logs -f backend web`.

## Apps

| App | Description | Port | Docs |
|-----|-------------|------|------|
| `@qalnet/backend` | NestJS REST API | 4000 | `/api/docs` (dev) |
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
| `start-ngrok.ps1` | Open an ngrok tunnel to the backend (port 4000) |
| `update-keys.cjs` | Regenerate RSA JWT key pair in the root `.env` |
| `test-reg.cjs` | Smoke-test `POST /api/v1/auth/register` locally |
| `db/dbcheck.cjs` | Check DB connectivity, tables, and record counts |
| `db/archive/` | Archived one-off diagnostics (check-rls, db-state) |

Run them from the repo root, e.g. `node scripts/db/dbcheck.cjs`.
