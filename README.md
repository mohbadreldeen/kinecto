# Kinecto

Kinecto is a multi-tenant loyalty and customer engagement platform for businesses such as cafes, salons, and retail shops.

The system helps each business to:

- manage customers and basic CRM data
- run loyalty operations (points, balances, rewards)
- send campaigns through WhatsApp and email
- manage employees and access roles
- view key operational metrics in a dashboard
- issue wallet passes (Apple/Google Wallet via PassKit)

## Tech Stack

- Frontend and API: Next.js (App Router) + TypeScript + Tailwind
- Data layer: Supabase Postgres + Drizzle ORM
- Auth: Supabase Auth
- Hosting target: Vercel
- Integrations: WhatsApp, Email, PassKit
- App mode: PWA-ready (service worker, installable UX)

## Repository Structure

- `client/`: main Next.js application
- `docs/`: product and implementation documentation
- `scripts/`: helper scripts for setup, migration, seeding, and local db tasks

## Quick Local Setup

### 1. Prerequisites

Install:

- Node.js 20+
- npm
- Supabase CLI (for local Supabase)
- Docker Desktop (required by local Supabase CLI stack)

### 2. Install dependencies

From repo root:

```bash
cd client
npm install
```

### 3. Create local environment file

Create `client/.env.local` with the minimum required values:

```env
# Supabase (local defaults shown)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-or-hosted-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-or-hosted-service-role-key

# Postgres
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# App secrets
APP_ENCRYPTION_KEY=replace-with-a-long-random-string

# App URL (used for invite/customer links)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Recommended for safe local/demo messaging behavior
MESSAGING_MOCK_MODE=on
```

Notes:

- `DATABASE_URL` is required by Drizzle and server-side db access.
- `APP_ENCRYPTION_KEY` is required for encrypted integration credentials.
- Keep `MESSAGING_MOCK_MODE=on` unless you intentionally want real provider calls.

### 4. Start local Supabase stack

```bash
npm run supabase:start
```

### 5. Apply schema and seed data

```bash
npm run db:push
npm run db:seed
```

### 6. Run the app

```bash
npm run dev
```

Open http://localhost:3000.

## Useful Commands

Run from `client/`:

- `npm run dev`: start development server
- `npm run build`: production build check
- `npm run test`: run unit/integration tests
- `npm run test:e2e`: run Playwright tests
- `npm run db:push`: push Drizzle schema
- `npm run db:seed`: seed demo data
- `npm run supabase:start`: start local Supabase services
- `npm run supabase:stop`: stop local Supabase services

## Deployment

For demo hosting on Vercel + Supabase Cloud, follow:

- `docs/vercel-supabase-demo-deploy.md`

That guide includes:

- exact required environment variables
- Supabase Auth URL setup
- schema + RLS + seed steps for hosted Supabase
- a demo-safe production checklist
