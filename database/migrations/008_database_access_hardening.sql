BEGIN;
-- The migration catalog is private too; the server receives read-only access.
ALTER TABLE castiq.migration_history ENABLE ROW LEVEL SECURITY;
-- Supabase's table-creation event trigger does not need a public RPC entrypoint.
DO $$ DECLARE target_role text; BEGIN
 IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=target_role) THEN
    EXECUTE format('REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM %I',target_role);
   END IF;
  END LOOP;
 END IF;
END $$;
COMMIT;
