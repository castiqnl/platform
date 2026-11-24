-- Quickstart is configured once for staging. Browser roles never access secrets
-- or account candidates; the trusted API checks current actor/club membership.
CREATE TABLE castiq.post_for_me_config (
 id text PRIMARY KEY CHECK(id='staging'), version integer NOT NULL DEFAULT 1,
 project_id text NOT NULL DEFAULT '', key_fingerprint text NOT NULL DEFAULT '',
 encrypted_api_key text, enabled boolean NOT NULL DEFAULT false,
 api_test_status text NOT NULL DEFAULT 'untested' CHECK(api_test_status IN ('untested','success','invalid','unavailable')),
 api_test_at timestamptz, webhook_id text, encrypted_webhook_secret text,
 webhook_status text NOT NULL DEFAULT 'unconfigured' CHECK(webhook_status IN ('unconfigured','registered','error')),
 webhook_checked_at timestamptz, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.post_for_me_connections (
 club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')),
 project_id text NOT NULL, account_id text NOT NULL, provider_account_id text NOT NULL,
 account_name text NOT NULL, avatar_url text, status text NOT NULL CHECK(status IN ('connected','disconnected','revocation_pending','verification_failed')),
 authorization_id uuid NOT NULL, version integer NOT NULL DEFAULT 1,
 checked_at timestamptz, connected_at timestamptz NOT NULL DEFAULT now(),
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(club_id,provider), UNIQUE(project_id,account_id)
);
-- An account's historic club ownership survives reconnects and channel changes.
CREATE TABLE castiq.post_for_me_account_claims (
 project_id text NOT NULL, account_id text NOT NULL, club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')), provider_account_id text NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(project_id,account_id),
 UNIQUE(project_id,provider,provider_account_id)
);
CREATE TRIGGER post_for_me_claims_immutable BEFORE UPDATE OR DELETE ON castiq.post_for_me_account_claims
 FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
CREATE TABLE castiq.post_for_me_flows (
 id uuid PRIMARY KEY, actor_id text NOT NULL, club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 provider text NOT NULL CHECK(provider IN ('facebook','instagram')),
 project_id text NOT NULL, key_fingerprint text NOT NULL, session_hash text NOT NULL, browser_hash text NOT NULL,
 expected_connection_version integer NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','returned','select','connected','cancelled','failed','expired')),
 callback_result jsonb NOT NULL DEFAULT '{}', candidates jsonb NOT NULL DEFAULT '[]',
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 returned_at timestamptz, completed_at timestamptz
);
CREATE UNIQUE INDEX post_for_me_one_session_flow ON castiq.post_for_me_flows(session_hash)
 WHERE status IN ('pending','returned','select');
CREATE TABLE castiq.post_for_me_webhook_events (
 id text PRIMARY KEY, project_id text NOT NULL, event_type text NOT NULL, payload jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, error_code text, next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_for_me_pending_webhooks ON castiq.post_for_me_webhook_events(next_attempt_at)
 WHERE processed_at IS NULL;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['post_for_me_config','post_for_me_connections','post_for_me_account_claims','post_for_me_flows','post_for_me_webhook_events'] LOOP
  EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON castiq.%I FROM PUBLIC',table_name);
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM anon',table_name); END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM authenticated',table_name); END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='castiq_runtime') THEN
   EXECUTE format('GRANT SELECT,INSERT ON castiq.%I TO castiq_runtime',table_name);
   IF table_name<>'post_for_me_account_claims' THEN EXECUTE format('GRANT UPDATE ON castiq.%I TO castiq_runtime',table_name); END IF;
   EXECUTE format('CREATE POLICY runtime_access ON castiq.%I TO castiq_runtime USING(true) WITH CHECK(true)',table_name);
  END IF;
 END LOOP;
END $$;
