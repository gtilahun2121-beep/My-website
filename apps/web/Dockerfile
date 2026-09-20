# syntax=docker/dockerfile:1
# QalNet web image.
#
# Build context MUST be the monorepo root (docker-compose.yml sets this).
# The full monorepo stays in the image because next.config.ts resolves the
# Turbopack root as two levels above apps/web (i.e. /app).

FROM node:22-slim AS build
WORKDIR /app

ENV CI=1

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Workspace manifests only, so `npm ci` has the full lockfile graph.
COPY package.json package-lock.json .npmrc turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --no-audit --no-fund

# Copy the full source tree (node_modules/.next/.env are excluded via .dockerignore).
COPY . .

# Build only the web app.
RUN npx turbo build --filter=@qalnet/web \
    && node -e "require('fs').accessSync('apps/web/.next/BUILD_ID')"

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3001').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/app/node_modules/next/dist/bin/next", "start", "-p", "3001"]