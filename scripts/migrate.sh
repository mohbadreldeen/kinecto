#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[migrate] Pushing Drizzle schema"
npx drizzle-kit push
