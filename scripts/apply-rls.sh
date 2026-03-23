#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
RLS_FILE="$CLIENT_DIR/supabase/migrations/00001_rls_policies.sql"

if [[ ! -f "$RLS_FILE" ]]; then
  echo "[db:rls] Missing RLS SQL file: $RLS_FILE" >&2
  exit 1
fi

cd "$CLIENT_DIR"

CONTAINER_NAME="$(docker ps --format "{{.Names}}" | grep "supabase_db_" | head -n 1 || true)"
if [[ -z "$CONTAINER_NAME" ]]; then
  echo "[db:rls] Supabase DB container is not running. Start it with: npx supabase start" >&2
  exit 1
fi

echo "[db:rls] Applying RLS policies via container: $CONTAINER_NAME"
cat "$RLS_FILE" | docker exec -i "$CONTAINER_NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1

echo "[db:rls] Done"
