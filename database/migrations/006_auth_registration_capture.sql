BEGIN;
-- Supabase Auth lifecycle metadata only; never grant roles from user metadata.
CREATE TABLE castiq.auth_registration_sources (
 actor_id text PRIMARY KEY, auth_created_at timestamptz NOT NULL,
 source text NOT NULL CHECK(source IN ('signup','pending_invitation','provisioned','unknown')),
 first_registration_at timestamptz, invited_at timestamptz,
 observed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE castiq.auth_registration_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON castiq.auth_registration_sources FROM PUBLIC;
CREATE OR REPLACE FUNCTION castiq.capture_auth_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,castiq AS $$
DECLARE origin text; start_at timestamptz; prior castiq.auth_registration_sources%ROWTYPE;
BEGIN
 SELECT * INTO prior FROM castiq.auth_registration_sources WHERE actor_id=NEW.id::text FOR UPDATE;
 IF coalesce(NEW.raw_app_meta_data->>'castiq_provisioning','') IN ('platform_admin','managed_account')
 OR EXISTS(SELECT 1 FROM castiq.memberships WHERE actor_id=NEW.id::text AND role='platform') THEN
  origin:='provisioned'; start_at:=NULL;
 ELSIF NEW.invited_at IS NOT NULL THEN
  IF NEW.email_confirmed_at IS NOT NULL AND NEW.last_sign_in_at IS NOT NULL THEN
   origin:='signup'; start_at:=COALESCE(prior.first_registration_at,NEW.last_sign_in_at);
  ELSE origin:='pending_invitation'; start_at:=NULL; END IF;
 ELSIF NEW.raw_app_meta_data->>'provider' IN ('email','google') THEN
  origin:='signup'; start_at:=COALESCE(prior.first_registration_at,NEW.created_at);
 ELSE origin:='unknown'; start_at:=NULL;
 END IF;
 INSERT INTO castiq.auth_registration_sources(actor_id,auth_created_at,source,first_registration_at,invited_at)
 VALUES(NEW.id::text,NEW.created_at,origin,start_at,NEW.invited_at)
 ON CONFLICT(actor_id) DO UPDATE SET source=EXCLUDED.source,
 first_registration_at=CASE WHEN EXCLUDED.source='signup' THEN COALESCE(castiq.auth_registration_sources.first_registration_at,EXCLUDED.first_registration_at) ELSE NULL END,
 invited_at=EXCLUDED.invited_at;
 IF origin='signup' THEN
  INSERT INTO castiq.privacy_accounts(actor_id,email,status,registration_started_at,auth_created_for_registration)
  VALUES(NEW.id::text,NEW.email,'registration_pending',start_at,NEW.invited_at IS NULL)
  ON CONFLICT(actor_id) DO NOTHING;
 ELSIF origin IN ('pending_invitation','provisioned') THEN
  -- GoTrue may set invitation/provisioning fields in a second statement. Only remove the
  -- pristine concept created by this trigger, never a completed account or club access.
  DELETE FROM castiq.privacy_accounts a WHERE a.actor_id=NEW.id::text
   AND a.status='registration_pending' AND a.registration_completed_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM castiq.legal_acceptances l WHERE l.actor_id=a.actor_id)
   AND NOT EXISTS(SELECT 1 FROM castiq.memberships m WHERE m.actor_id=a.actor_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION castiq.capture_auth_registration() FROM PUBLIC;
DO $$ BEGIN
 IF to_regclass('auth.users') IS NOT NULL THEN
  EXECUTE 'CREATE TRIGGER castiq_capture_registration AFTER INSERT OR UPDATE OF invited_at,email_confirmed_at,last_sign_in_at,raw_app_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION castiq.capture_auth_registration()';
  -- Existing provider identities are inventoried, not retroactively declared abandoned.
  -- Before rollout both projects were empty; the deliberately provisioned first admin
  -- remains an explicitly provisioned identity, never a seven-day cleanup candidate.
  EXECUTE $inventory$INSERT INTO castiq.auth_registration_sources(actor_id,auth_created_at,source,invited_at)
   SELECT u.id::text,u.created_at,CASE
    WHEN EXISTS(SELECT 1 FROM castiq.memberships m WHERE m.actor_id=u.id::text AND m.role='platform')
     OR coalesce(u.raw_app_meta_data->>'castiq_provisioning','') IN ('platform_admin','managed_account') THEN 'provisioned'
    WHEN u.invited_at IS NOT NULL THEN 'pending_invitation' ELSE 'unknown' END,u.invited_at
   FROM auth.users u ON CONFLICT DO NOTHING$inventory$;
 END IF;
END $$;
COMMIT;
