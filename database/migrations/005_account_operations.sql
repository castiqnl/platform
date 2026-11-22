BEGIN;
CREATE TABLE castiq.account_operation_keys (
 id integer PRIMARY KEY CHECK(id=1), key_sha256 text NOT NULL CHECK(key_sha256 ~ '^[a-f0-9]{64}$'),
 revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE castiq.account_operation_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON castiq.account_operation_keys FROM PUBLIC;
-- Only the Edge Function's built-in service role can authorize this narrow API.
-- The application never receives a Supabase service role key or auth schema access.
CREATE FUNCTION public.castiq_authorize_account_operation(p_key_sha256 text,p_operation text,p_actor_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE permitted boolean;
BEGIN
 IF p_key_sha256 IS NULL OR NOT EXISTS(SELECT 1 FROM castiq.account_operation_keys WHERE id=1 AND NOT revoked AND key_sha256=p_key_sha256) THEN RETURN false; END IF;
 IF p_operation='ensure_admin' THEN RETURN p_actor_id IS NULL; END IF;
 IF p_actor_id IS NULL OR p_actor_id !~ '^[a-f0-9-]{36}$' THEN RETURN false; END IF;
 IF p_operation='revoke_sessions' THEN
   SELECT EXISTS(SELECT 1 FROM castiq.privacy_accounts WHERE actor_id=p_actor_id AND status IN ('deletion_pending','deleting')) INTO permitted;
   IF permitted THEN DELETE FROM auth.sessions WHERE user_id=p_actor_id::uuid; END IF;
   RETURN permitted;
 END IF;
 IF p_operation='delete_identity' THEN
   RETURN EXISTS(SELECT 1 FROM castiq.privacy_deletions WHERE actor_id=p_actor_id AND status='processing');
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.castiq_authorize_account_operation(text,text,text) FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
 GRANT EXECUTE ON FUNCTION public.castiq_authorize_account_operation(text,text,text) TO service_role;
END IF; END $$;
COMMIT;
