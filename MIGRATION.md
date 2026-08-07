# Monorepo Migration Guide

This guide walks through moving the existing source code into the new Turborepo structure.

## Step 1 — Move backend source files

Run these commands from the repo root (`qalnet Backend & Database/`):

```cmd
:: Move NestJS source
xcopy /E /I /Y src apps\backend\src

:: Move database SQL files
xcopy /E /I /Y database apps\backend\database

:: Move test files
xcopy /E /I /Y test apps\backend\test

:: Copy nest-cli.json if it exists
copy nest-cli.json apps\backend\nest-cli.json
```

After copying, delete the old root-level `src/`, `database/`, `test/` folders
once you've verified the backend builds correctly from `apps/backend/`.

## Step 2 — Move frontend source files

```cmd
:: Move Next.js source, public, and config files
xcopy /E /I /Y QAL\src apps\web\src
xcopy /E /I /Y QAL\public apps\web\public

:: Copy Next.js config files
copy QAL\next.config.ts apps\web\next.config.ts
copy QAL\postcss.config.mjs apps\web\postcss.config.mjs
copy QAL\eslint.config.mjs apps\web\eslint.config.mjs
```

After verifying the frontend builds from `apps/web/`, you can remove the `QAL/` folder.

## Step 3 — Install dependencies

From the repo root:

```bash
npm install
```

This installs all workspace dependencies including the `@qalnet/shared-types`
and `@qalnet/typescript-config` internal packages.

## Step 4 — Verify builds

```bash
# Type-check everything
npm run type-check

# Build everything (backend then frontend, respecting dependency order)
npm run build

# Start dev (both apps in parallel)
npm run dev
```

## Step 5 — Use shared types in your code

### In the backend (NestJS)
```typescript
import { RegisterRequest, AuthTokens } from '@qalnet/shared-types';
```

### In the frontend (Next.js)
```typescript
import type { RegisterRequest, AuthTokens } from '@qalnet/shared-types';
```

## Step 6 — Remove nested git repo in QAL/

If the `QAL/` folder had its own `.git` directory, remove it after migration:

```cmd
rmdir /s /q QAL\.git
```

Then commit everything under the single root `.git`.

## Port Reference

| App | Dev Port |
|-----|----------|
| Backend (NestJS) | 3000 |
| Frontend (Next.js) | 3001 |
