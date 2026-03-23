#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../client"

echo "[dev] Starting Supabase local services"
npx supabase start

echo "[dev] Starting Next.js dev server"
npm run dev
