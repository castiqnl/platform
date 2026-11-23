BEGIN;
-- Private server tables. No browser/Data API grant; mutations are checked against
-- current memberships by the API. Monetary values are integer EUR cents.
CREATE TABLE castiq.plan_policies (
 version integer PRIMARY KEY CHECK(version>0), document jsonb NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO castiq.plan_policies(version,document,created_by) VALUES(1,'{"discountPercent":10,"currency":"EUR","tax":"exclusive","billingActivated":false,"plans":[{"name":"Gratis","baseCents":0,"teamLimit":null,"description":"Met vast Castiq-partnerlogo"},{"name":"Start","baseCents":3900,"teamLimit":5,"description":"Een sterke basis voor kleine clubs."},{"name":"Club","baseCents":6900,"teamLimit":20,"description":"Alle teams en één herkenbare clubstem."},{"name":"Pro","baseCents":11900,"teamLimit":50,"description":"Meer ruimte voor ambitieuze verenigingen."}]}','migration');
CREATE TABLE castiq.club_plan_choices (
 club_id text PRIMARY KEY REFERENCES castiq.workspaces(club_id), version integer NOT NULL CHECK(version>0),
 plan_name text NOT NULL CHECK(plan_name IN ('Gratis','Start','Club','Pro')), opted_in boolean NOT NULL,
 accepted_policy_version integer NOT NULL REFERENCES castiq.plan_policies(version),
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.plan_events (
 id uuid PRIMARY KEY, club_id text, actor_id text NOT NULL, action text NOT NULL,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_events_club_created ON castiq.plan_events(club_id,created_at DESC);
CREATE TABLE castiq.social_oauth_flows (
 id uuid PRIMARY KEY, club_id text NOT NULL REFERENCES castiq.workspaces(club_id), actor_id text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('instagram','facebook','x')), state_hash text UNIQUE NOT NULL, nonce_hash text NOT NULL,
 encrypted_verifier text, encrypted_candidates text, candidates jsonb NOT NULL DEFAULT '[]',
 expected_connection_version integer NOT NULL DEFAULT 0,
 status text NOT NULL CHECK(status IN ('pending','processing','select','connected','denied','failed','expired')),
 error_code text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_flows_expiry ON castiq.social_oauth_flows(expires_at);
CREATE INDEX social_flows_tenant_actor ON castiq.social_oauth_flows(club_id,actor_id,created_at DESC);
CREATE TABLE castiq.social_connections (
 club_id text NOT NULL REFERENCES castiq.workspaces(club_id), provider text NOT NULL CHECK(provider IN ('instagram','facebook','x')),
 version integer NOT NULL CHECK(version>0), account_id text NOT NULL, account_name text NOT NULL, account_type text NOT NULL,
 destinations jsonb NOT NULL, scopes jsonb NOT NULL, encrypted_tokens text,
 status text NOT NULL CHECK(status IN ('connected','expired','revoked','disconnected','verification_failed','revocation_pending')),
 expires_at timestamptz, checked_at timestamptz, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(club_id,provider)
);
CREATE TABLE castiq.social_events (
 id uuid PRIMARY KEY, club_id text NOT NULL, actor_id text NOT NULL, provider text NOT NULL,
 action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_events_tenant_created ON castiq.social_events(club_id,created_at DESC);
CREATE TRIGGER immutable_plan_policies BEFORE UPDATE OR DELETE ON castiq.plan_policies FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
CREATE TRIGGER immutable_plan_events BEFORE UPDATE OR DELETE ON castiq.plan_events FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
CREATE TRIGGER immutable_social_events BEFORE UPDATE OR DELETE ON castiq.social_events FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['plan_policies','club_plan_choices','plan_events','social_oauth_flows','social_connections','social_events'] LOOP
  EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON castiq.%I FROM PUBLIC',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM anon',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM authenticated',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='castiq_runtime') THEN
   IF t IN ('plan_policies','plan_events','social_events') THEN EXECUTE format('GRANT SELECT,INSERT ON castiq.%I TO castiq_runtime',t); ELSE EXECUTE format('GRANT SELECT,INSERT,UPDATE ON castiq.%I TO castiq_runtime',t); END IF;
   EXECUTE format('CREATE POLICY server_access ON castiq.%I TO castiq_runtime USING(true) WITH CHECK(true)',t);
  END IF;
 END LOOP;
END $$;
COMMIT;
