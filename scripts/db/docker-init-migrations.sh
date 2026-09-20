#!/usr/bin/env bash
#
# 02-migrations.sh
#
# Runs ONLY on a FRESH Postgres data volume (the official postgres image
# executes every *.sh / *.sql directly inside /docker-entrypoint-initdb.d in
# lexical order, once, during the very first container start).
#
# WHY THIS WRAPPER EXISTS
# -----------------------
# The Docker postgres image does NOT recurse into sub-directories, so mounting
# `apps/backend/database/migrations/` directly into initdb.d is ignored. We
# mount the folder at a neutral path and iterate the *.sql files here instead.
#
# Migrations are written to be additive and idempotent (all DDL uses
# IF NOT EXISTS / CREATE OR REPLACE), so re-applying them as a group on top of
# the base schema is safe.
set -e

migrations_dir="/docker-entrypoint-initdb.d/migrations"

if [ ! -d "$migrations_dir" ]; then
  echo "[migrations] Migrations directory not found — skipping."
  exit 0
fi

for f in "$migrations_dir"/*.sql; do
  [ -e "$f" ] || continue
  echo "[migrations] Applying $(basename "$f")"
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -f "$f"
done

echo "[migrations] All migrations applied."
