#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[stop] Stopping Supabase local services"
npx supabase stop
