#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[reset] Resetting Supabase local database"
npx supabase db reset

echo "[reset] Running seed"
npm run db:seed
