# Kinecto Implementation Plan

## Status: Phase 0 — Foundation (Planning)

## Phase 0: Foundation

### Step 1 — Database Schema (Drizzle ORM + SQL)

Files to create:

- `client/lib/db/schema/tenant.ts`
- `client/lib/db/schema/user.ts`
- `client/lib/db/schema/customer.ts`
- `client/lib/db/schema/transaction.ts`
- `client/lib/db/schema/campaign.ts`
- `client/lib/db/schema/message.ts`
- `client/lib/db/schema/segment.ts`
- `client/lib/db/schema/api-key.ts`
- `client/lib/db/schema/index.ts`
- `client/lib/db/index.ts`
- `client/lib/db/seed.ts`
- `docs/schema.sql` (SQL reference + RLS)
- `client/drizzle.config.ts`
- `client/supabase/migrations/00001_rls_policies.sql`

### Step 2 — Project Scaffolding (parallel with Step 1)

- create-next-app inside `client/` with App Router, TS, Tailwind
- supabase init inside `client/`
- Install deps: drizzle-orm, @supabase/ssr, @tanstack/react-query, zustand, react-hook-form, zod, next-intl, @upstash/ratelimit
- Dev deps: drizzle-kit, vitest, @playwright/test, @testing-library/react
- shadcn/ui init + base components
- Folder structure per PRD §7.3 (rooted at `client/`)
- client/middleware.ts, client/.env.local, client/components.json

### Step 3 — Local Dev Verification (depends on Step 2)

- Run `scripts/setup.sh` (one-time full setup)
- Run `scripts/dev.sh` (start local dev environment)
- Seed script with 2 test tenants via `scripts/seed.sh`
- RLS cross-tenant test

### Bash Scripts (`scripts/`)

All local setup and dev commands are managed via bash scripts:

| Script               | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `scripts/setup.sh`   | One-time setup: install deps, supabase init, drizzle-kit push |
| `scripts/dev.sh`     | Start local dev: supabase start + next dev                    |
| `scripts/seed.sh`    | Run seed script against local DB                              |
| `scripts/migrate.sh` | Run Drizzle migrations (push to local or production)          |
| `scripts/stop.sh`    | Stop local Supabase stack                                     |
| `scripts/reset.sh`   | Reset local DB: supabase db reset + re-seed                   |

## Phase 1–6: Milestones (per PRD §13)

1. Setup + Auth + DB → depends on Phase 0
2. Customer + Employee Flow → depends on Phase 1
3. Dashboard + CRM → depends on Phase 2
4. Messaging Integration → depends on Phase 3
5. Wallet Integration → depends on Phase 2 (parallel with Phase 4)
6. PWA + Testing + Deploy → depends on all

## Key Decisions

- user table links to Supabase auth.users via auth_user_id
- JSONB for flexible fields (settings, brand_colors, stats, filter_criteria)
- Soft deletes via status column
- Phase 4 & 5 can run in parallel
- Both Drizzle ORM schema + SQL reference requested
