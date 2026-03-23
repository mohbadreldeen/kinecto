#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[seed] Running database seed"
npm run db:seed
