# QalNet Monorepo

Digital Equb Platform — unified monorepo powered by [Turborepo](https://turbo.build).

## Structure

```
qalnet/
├── apps/
│   ├── backend/        # NestJS API (port 3000)
│   └── web/            # Next.js frontend (port 3001)
├── packages/
│   ├── shared-types/   # Shared TypeScript types (DTOs, interfaces)
│   └── typescript-config/  # Shared tsconfig bases
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

### Run a specific app
```bash
# Backend only
npm run dev --filter=@qalnet/backend

# Frontend only
npm run dev --filter=@qalnet/web
```

### Build everything
```bash
npm run build
```

### Run tests
```bash
npm run test
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

## Migrating existing source files

The existing source code still lives in the root `src/` and `QAL/` directories.
Move them to their respective app folders:

```bash
# Backend source → apps/backend/src/
# Backend database → apps/backend/database/

# Frontend source → apps/web/src/
# Frontend public → apps/web/public/
```

See `MIGRATION.md` for the full step-by-step guide.
