# Kinecto Demo Deployment Guide

This guide explains how to move the current app from local development to a live demo hosted on Vercel and Supabase.

It is written for this repository specifically, not for a generic Next.js app.

The target result is:

- Frontend and API hosted on Vercel
- Database, Auth, and storage hosted on Supabase Cloud
- No custom domain required
- Stable demo URL using the default Vercel production domain: `https://your-project-name.vercel.app`

If this is only for a demo, that is the right setup. Do not use preview deployment URLs as your main demo link, because those URLs change on every commit.

## 1. What This App Needs In Production

This app currently depends on:

- Next.js 16 app hosted on Vercel
- Supabase Auth for login/session handling
- Postgres accessed directly via `DATABASE_URL`
- Drizzle ORM for schema push/seed
- Supabase service-role access for admin tasks and seeding
- App-level encryption for saved integration credentials
- Optional messaging and wallet integrations

Important deployment facts for this repo:

- The Vercel project root must be `client`
- The app reads data from `DATABASE_URL`
- The app reads Supabase keys from env vars
- Integration credentials saved from the UI rely on `APP_ENCRYPTION_KEY`
- Invite links and QR/customer links work best when `NEXT_PUBLIC_APP_URL` matches the deployed URL
- The local `scripts/apply-rls.sh` script only works with the local Docker-based Supabase setup, not Supabase Cloud

## 2. Recommended Demo Strategy

For a demo, use this approach:

1. Create one hosted Supabase project
2. Deploy one Vercel production app from your main branch
3. Use the default Vercel production domain
4. Seed demo data into Supabase Cloud
5. Keep messaging in mock mode unless you truly need real delivery

That gives you a stable demo without needing a purchased domain.

## 3. Prerequisites

Before starting, make sure you have:

- A Git repo connected to GitHub/GitLab/Bitbucket
- A Vercel account
- A Supabase account
- Node.js 20+ locally
- npm available locally

Optional but useful:

- Supabase CLI
- `psql` or another SQL client

## 4. Create The Hosted Supabase Project

### 4.1 Create the project

In Supabase:

1. Create a new project
2. Choose a nearby region
3. Save the database password somewhere safe

When the project is ready, collect these values from Supabase:

- Project URL
- Anon/public key
- Service role key
- Database connection string

You will use them in both local setup and Vercel.

### 4.2 Use a stable database connection string

This app uses `pg` with a connection pool in server code.

For Vercel, prefer the pooled Supabase connection string if available. In Supabase this is usually the pooled or Supavisor connection string. That is safer for serverless workloads than a raw direct connection.

If you only see a direct Postgres URL, it can work for a small demo, but pooled is better.

## 5. Prepare Production Environment Variables

This app needs these environment variables.

### 5.1 Required

Set all of these in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-pooled-postgres-connection-string
APP_ENCRYPTION_KEY=generate-a-long-random-secret
NEXT_PUBLIC_APP_URL=https://your-project-name.vercel.app
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required for seed/admin flows and some auth admin operations.
- `APP_ENCRYPTION_KEY` is required if you use the Settings pages to save Email/WhatsApp/PassKit credentials.
- `NEXT_PUBLIC_APP_URL` should point to your final Vercel production URL so generated QR/customer links are correct.

### 5.2 Recommended For Demo Safety

```env
MESSAGING_MOCK_MODE=on
```

In this repo, messaging defaults to mock mode unless `MESSAGING_MOCK_MODE=off`.

For a demo, keep it mocked unless you really need real WhatsApp/email delivery.

### 5.3 Optional

Only add these if you need them:

```env
MESSAGING_JOB_SECRET=some-random-secret
MESSAGING_WEBHOOK_SECRET=some-random-secret
PASSKIT_BASE_URL=https://your-passkit-provider
PASSKIT_API_KEY=provider-key
PASSKIT_TEMPLATE_ID=provider-template-id
```

Use cases:

- `MESSAGING_JOB_SECRET`: for calling the queue-processing API securely from an external job
- `MESSAGING_WEBHOOK_SECRET`: for validating inbound provider webhooks
- `PASSKIT_*`: only if you want a global env-based PassKit fallback instead of storing PassKit keys through the Settings UI

## 6. Configure Supabase Auth For The Demo URL

In Supabase Dashboard:

1. Open Authentication
2. Open URL configuration
3. Set Site URL to your Vercel production URL:

```text
https://your-project-name.vercel.app
```

4. Add additional redirect URLs at minimum for:

```text
https://your-project-name.vercel.app/login
https://your-project-name.vercel.app/accept-invite
https://your-project-name.vercel.app
```

Why this matters:

- Password reset returns to `/login`
- Employee invite flows land on `/accept-invite`
- Auth/session flows should resolve against the same production host

If you later rename the Vercel project, update these URLs in Supabase and update `NEXT_PUBLIC_APP_URL`.

## 7. Push The Database Schema To Hosted Supabase

This repo uses Drizzle for schema management.

### 7.1 Install dependencies locally

From the repo root:

```bash
cd client
npm install
```

### 7.2 Export env vars locally for the remote project

Use your hosted Supabase values locally before running migration commands.

PowerShell:

```powershell
$env:DATABASE_URL="your-pooled-postgres-url"
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:APP_ENCRYPTION_KEY="your-long-random-secret"
```

Bash:

```bash
export DATABASE_URL="your-pooled-postgres-url"
export NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export APP_ENCRYPTION_KEY="your-long-random-secret"
```

### 7.3 Push the schema

```bash
npm run db:push
```

This uses the same Drizzle config as the app.

## 8. Apply RLS Policies To Hosted Supabase

This step is easy to miss.

The repo contains RLS policies in:

- `client/supabase/migrations/00001_rls_policies.sql`

The existing helper script:

- `scripts/apply-rls.sh`

only works against the local Docker Supabase container. It does not apply policies to a hosted Supabase project.

### 8.1 Apply the RLS SQL manually in Supabase Cloud

In Supabase Dashboard:

1. Open SQL Editor
2. Open the contents of `client/supabase/migrations/00001_rls_policies.sql`
3. Run that SQL against your hosted project

Do not skip this. Without RLS policies, your tenant separation and access restrictions will not match local expectations.

## 9. Seed Demo Data Into Hosted Supabase

This repo includes a real seed script.

Run:

```bash
npm run db:seed
```

The seed creates a demo tenant and users using the Supabase admin API.

Current built-in demo credentials from the seed file:

- Owner: `test@test.com` / `TestPass123!`
- Employee: `employee.one@test.com` / `TestPass123!`
- Employee: `employee.two@test.com` / `TestPass123!`

The seed also creates:

- Demo tenant: `Demo Cafe`
- Sample customers
- Sample membership records

For a demo, this is useful because it gives you working owner and employee logins immediately.

If you do not want these exact public demo credentials, change them in `client/lib/db/seed.ts` before seeding production.

## 10. Create The Vercel Project

### 10.1 Import the repo

In Vercel:

1. Click Add New Project
2. Import the repository

### 10.2 Set the project root correctly

This repo is not rooted at the Next app.

Set:

- Root Directory: `client`

### 10.3 Confirm framework settings

Vercel should detect Next.js automatically.

Expected settings:

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output: Next.js default

### 10.4 Add environment variables

Add all required env vars from Section 5 to the Vercel project.

For a demo, add them to:

- Production
- Preview, if you also want previews to work

## 11. First Deployment Order

Use this order to avoid broken auth URLs:

1. Create Supabase project
2. Push DB schema
3. Apply RLS SQL
4. Seed demo data
5. Create Vercel project
6. Deploy once
7. Copy the final production Vercel URL
8. Set `NEXT_PUBLIC_APP_URL` to that URL in Vercel
9. Set Supabase Auth Site URL and redirects to that same URL
10. Redeploy Vercel

That second deploy is normal. It ensures generated links and auth redirects all use the final domain.

## 12. Demo-Safe Defaults

For a demo, these choices reduce risk:

### 12.1 Keep messaging mocked

Set:

```env
MESSAGING_MOCK_MODE=on
```

This prevents the app from sending real WhatsApp/email messages unless you intentionally switch it off.

### 12.2 Skip webhook setup unless you need it

If this is just a demo, you can avoid setting:

- `MESSAGING_WEBHOOK_SECRET`
- external provider webhook URLs

### 12.3 Use manual queue processing

The owner campaign UI already includes manual queue processing actions.

For a demo, that is simpler than setting up scheduled jobs or cron.

### 12.4 Only configure PassKit if you want to show it live

If wallet integration is not essential for the demo, leave PassKit unconfigured.

The wallet pages can still render without real provider credentials.

## 13. Post-Deploy Verification Checklist

After deployment, verify these flows in the production Vercel URL:

### 13.1 Auth

- Owner can sign in
- Employee can sign in
- Reset password page loads
- Accept invite page loads

### 13.2 Tenant separation and RLS

- Owner sees only demo tenant data
- Employee sees only allowed employee routes/data
- Disabled employee cannot access employee workspace

### 13.3 Core pages

- Dashboard loads
- Customers page loads and search works
- Campaigns page loads
- Wallet page loads
- Settings pages load
- Employee interface loads on tablet-sized viewport

### 13.4 i18n and Arabic UI

- Language switcher works
- Arabic switches UI to RTL
- Cairo font is applied when Arabic is active

### 13.5 PWA

- App installs successfully from supported browser
- Icons/manifest load without 404s

## 14. Common Problems And Fixes

### Problem: login works locally but production shows auth redirect issues

Usually caused by:

- Supabase Site URL not matching the Vercel production URL
- Missing redirect URLs in Supabase Auth
- `NEXT_PUBLIC_APP_URL` still pointing to localhost or blank

Fix:

- Update Supabase Auth URLs
- Update `NEXT_PUBLIC_APP_URL`
- redeploy Vercel

### Problem: app boots but database queries fail

Usually caused by:

- wrong `DATABASE_URL`
- direct DB URL blocked or exhausted on serverless
- schema was not pushed

Fix:

- use the Supabase pooled connection string
- rerun `npm run db:push`

### Problem: owner/employee access behaves incorrectly

Usually caused by:

- RLS policies were not applied to hosted Supabase

Fix:

- run the SQL from `client/supabase/migrations/00001_rls_policies.sql` in Supabase SQL Editor

### Problem: saving integration credentials fails

Usually caused by:

- missing `APP_ENCRYPTION_KEY`

Fix:

- set `APP_ENCRYPTION_KEY` in Vercel and in any local environment used for admin scripts

### Problem: invite links or QR/customer URLs use the wrong host

Usually caused by:

- missing or incorrect `NEXT_PUBLIC_APP_URL`

Fix:

- set it to `https://your-project-name.vercel.app`
- redeploy

## 15. Suggested Demo Launch Checklist

Use this as the minimum launch checklist:

1. Production Vercel deployment exists and opens normally
2. Supabase Site URL points to the production Vercel domain
3. All required env vars are set in Vercel
4. DB schema is pushed
5. RLS SQL is applied in hosted Supabase
6. Seed data exists
7. Owner login works
8. Employee login works
9. Messaging is in mock mode unless real sending is intentional
10. Arabic/English switching works

## 16. Minimal Command Summary

From `client`:

```bash
npm install
npm run db:push
npm run db:seed
npm run build
```

Then deploy the `client` directory to Vercel with the env vars configured.

## 17. Recommended Final Setup For Your Use Case

Because this is demo-only and you do not need a custom domain, the best setup is:

- Supabase hosted project for DB/Auth
- One Vercel production deployment from `main`
- Use `https://your-project-name.vercel.app`
- Keep `MESSAGING_MOCK_MODE=on`
- Seed demo users and customers

That gives you a stable public demo with the least amount of operational work.
