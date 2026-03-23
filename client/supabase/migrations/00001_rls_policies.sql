-- RLS policies for Kinecto tenant isolation

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenantId')::uuid;
$$;

DO $$
BEGIN
  IF to_regclass('public.tenant') IS NULL THEN
    RAISE NOTICE 'Skipping RLS setup: application tables are not created yet.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE tenant ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "user" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE customer ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "transaction" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE campaign ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE message ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE segment ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE api_key ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE employee_invite ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS tenant_self_select ON tenant';
  EXECUTE 'CREATE POLICY tenant_self_select ON tenant FOR SELECT USING (id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS tenant_self_update ON tenant';
  EXECUTE 'CREATE POLICY tenant_self_update ON tenant FOR UPDATE USING (id = public.get_tenant_id()) WITH CHECK (id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS user_tenant_access ON "user"';
  EXECUTE 'CREATE POLICY user_tenant_access ON "user" FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS customer_tenant_access ON customer';
  EXECUTE 'CREATE POLICY customer_tenant_access ON customer FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS transaction_tenant_access ON "transaction"';
  EXECUTE 'CREATE POLICY transaction_tenant_access ON "transaction" FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS campaign_tenant_access ON campaign';
  EXECUTE 'CREATE POLICY campaign_tenant_access ON campaign FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS message_tenant_access ON message';
  EXECUTE 'CREATE POLICY message_tenant_access ON message FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS segment_tenant_access ON segment';
  EXECUTE 'CREATE POLICY segment_tenant_access ON segment FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS api_key_tenant_access ON api_key';
  EXECUTE 'CREATE POLICY api_key_tenant_access ON api_key FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';

  EXECUTE 'DROP POLICY IF EXISTS employee_invite_tenant_access ON employee_invite';
  EXECUTE 'CREATE POLICY employee_invite_tenant_access ON employee_invite FOR ALL USING (tenant_id = public.get_tenant_id()) WITH CHECK (tenant_id = public.get_tenant_id())';
END $$;
