BEGIN;
ALTER TABLE castiq.privacy_cases ADD COLUMN extension_requested_at timestamptz;
ALTER TABLE castiq.privacy_cases ADD COLUMN extension_notification_key text;
-- Trigger records have different columns (receipts/attempts have no actor_id).
-- Inspect JSON only after checking operation and the explicit actor-bearing table list.
CREATE OR REPLACE FUNCTION castiq.prevent_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE fresh jsonb; prior jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_SCHEMA='castiq' AND TG_TABLE_NAME IN ('revisions','approvals','audit') THEN
   IF current_setting('castiq.privacy_erasure',true)='on' THEN
    fresh:=to_jsonb(NEW); prior:=to_jsonb(OLD);
    IF (fresh->>'actor_id') ~ '^erased:[a-f0-9]{64}$'
      AND (fresh-'actor_id')=(prior-'actor_id') THEN RETURN NEW; END IF;
   END IF;
  END IF;
 END IF;
 RAISE EXCEPTION 'immutable history';
END $$;
-- All referenced application relations are schema-qualified; prevent caller-selected lookup paths.
ALTER FUNCTION castiq.freeze_job_request() SET search_path=pg_catalog;
ALTER FUNCTION castiq.prevent_legal_document_mutation() SET search_path=pg_catalog;
ALTER FUNCTION castiq.prevent_mail_history_mutation() SET search_path=pg_catalog;
ALTER FUNCTION castiq.guard_mail_receipt() SET search_path=pg_catalog;
ALTER FUNCTION castiq.freeze_mail_payload() SET search_path=pg_catalog;
ALTER FUNCTION castiq.capture_auth_registration() SET search_path=pg_catalog;
REVOKE ALL ON FUNCTION castiq.prevent_history_mutation() FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA castiq FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA castiq FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA castiq FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON FUNCTIONS FROM PUBLIC;
-- Supabase can install explicit anon/authenticated default grants in addition to PUBLIC.
-- Restrict the narrow service-role RPC and this application's private schema only.
DO $$ DECLARE untrusted_role text; BEGIN
 FOREACH untrusted_role IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=untrusted_role) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION public.castiq_authorize_account_operation(text,text,text) FROM %I',untrusted_role);
   EXECUTE format('REVOKE ALL ON SCHEMA castiq FROM %I',untrusted_role);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA castiq FROM %I',untrusted_role);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA castiq FROM %I',untrusted_role);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA castiq FROM %I',untrusted_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON TABLES FROM %I',untrusted_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON SEQUENCES FROM %I',untrusted_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA castiq REVOKE ALL ON FUNCTIONS FROM %I',untrusted_role);
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION public.castiq_authorize_account_operation(text,text,text) TO service_role;
 END IF;
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='castiq_runtime') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON castiq.auth_registration_sources TO castiq_runtime;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='castiq' AND tablename='auth_registration_sources' AND policyname='server_access') THEN
   CREATE POLICY server_access ON castiq.auth_registration_sources TO castiq_runtime USING(true) WITH CHECK(true);
  END IF;
 END IF;
END $$;
COMMIT;
