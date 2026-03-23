-- Kinecto SQL Reference Schema
-- Generated to align with docs/PRD.md section 8 and client/lib/db/schema/*.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'employee');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_channel AS ENUM ('whatsapp', 'email');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE api_service AS ENUM ('whatsapp', 'passkit', 'email');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  brand_colors jsonb DEFAULT '{}'::jsonb,
  status tenant_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text,
  role user_role NOT NULL DEFAULT 'employee',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  points_balance integer NOT NULL DEFAULT 0,
  tags text[] DEFAULT ARRAY[]::text[],
  notes text,
  qr_code_url text,
  wallet_pass_id text,
  status customer_status NOT NULL DEFAULT 'active',
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "transaction" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel campaign_channel NOT NULL,
  template_body text NOT NULL,
  audience_type text NOT NULL,
  audience_criteria jsonb DEFAULT '{}'::jsonb,
  status campaign_status NOT NULL DEFAULT 'draft',
  stats jsonb DEFAULT '{"sent":0,"delivered":0,"failed":0}'::jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  channel text NOT NULL,
  content text NOT NULL,
  external_id text,
  status message_status NOT NULL DEFAULT 'queued',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filter_criteria jsonb NOT NULL,
  customer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_key (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  service api_service NOT NULL,
  encrypted_key text NOT NULL,
  label text,
  is_active text NOT NULL DEFAULT 'true',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_tenant_id_idx ON "user" (tenant_id);
CREATE INDEX IF NOT EXISTS customer_tenant_id_idx ON customer (tenant_id);
CREATE INDEX IF NOT EXISTS customer_phone_idx ON customer (phone);
CREATE INDEX IF NOT EXISTS customer_name_idx ON customer (name);
CREATE INDEX IF NOT EXISTS transaction_tenant_id_idx ON "transaction" (tenant_id);
CREATE INDEX IF NOT EXISTS transaction_customer_id_idx ON "transaction" (customer_id);
CREATE INDEX IF NOT EXISTS campaign_tenant_id_idx ON campaign (tenant_id);
CREATE INDEX IF NOT EXISTS message_tenant_id_idx ON message (tenant_id);
CREATE INDEX IF NOT EXISTS message_campaign_id_idx ON message (campaign_id);
CREATE INDEX IF NOT EXISTS segment_tenant_id_idx ON segment (tenant_id);
CREATE INDEX IF NOT EXISTS api_key_tenant_id_idx ON api_key (tenant_id);
