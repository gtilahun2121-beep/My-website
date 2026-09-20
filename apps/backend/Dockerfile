# syntax=docker/dockerfile:1
# QalNet backend image.
#
# Build context MUST be the monorepo root (docker-compose.yml sets this).
# Output:  dist/apps/backend/src/main.js  (nest build preserves the sourceRoot).
# Runtime: node apps/backend/dist/apps/backend/src/main.js

FROM node:22-slim AS build
WORKDIR /app

ENV CI=1

# Workspace manifests only, so `npm ci` has the full lockfile graph.
COPY package.json package-lock.json .npmrc turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# argon2 ships prebuilt binaries, but installing the toolchain guarantees a
# native rebuild when the runtime platform/node-version has no prebuild.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --no-audit --no-fund

# Copy the full source tree (node_modules/dist/.env are excluded via .dockerignore).
COPY . .

# Build only the backend app.
RUN npx turbo build --filter=@qalnet/backend \
    && node -e "require('fs').accessSync('apps/backend/dist/apps/backend/src/main.js')"

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

# The backend reads secrets from process.env in development mode
# (VaultConfig falls back to .env only when AWS integration is configured).
ENV NODE_ENV=development

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend ./apps/backend
COPY --from=build /app/packages ./packages

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/backend/dist/apps/backend/src/main.js"]