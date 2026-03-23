#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[setup] Installing npm dependencies"
npm install

echo "[setup] Ensuring Supabase project is initialized"
if [[ ! -f "supabase/config.toml" ]]; then
  npx supabase init
fi

echo "[setup] Applying Drizzle schema to local database"
npx drizzle-kit push

echo "[setup] Done"
