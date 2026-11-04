BEGIN;
CREATE SCHEMA IF NOT EXISTS castiq;
REVOKE ALL ON SCHEMA castiq FROM PUBLIC;
CREATE TABLE IF NOT EXISTS castiq.workspaces (
 club_id text PRIMARY KEY, version bigint NOT NULL DEFAULT 1, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS castiq.memberships (
 actor_id text NOT NULL, club_id text NOT NULL, actor_name text NOT NULL, role text NOT NULL CHECK(role IN ('club','team','platform')), team text,
 active boolean NOT NULL DEFAULT true, expires_at timestamptz, PRIMARY KEY(actor_id,club_id), CHECK(role <> 'team' OR team IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS castiq.sessions (
 token_hash text PRIMARY KEY, actor_id text NOT NULL, club_id text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS castiq.revisions (
 club_id text NOT NULL, content_id text NOT NULL, revision integer NOT NULL, content_hash text NOT NULL, snapshot jsonb NOT NULL,
 actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(club_id,content_id,revision)
);
CREATE TABLE IF NOT EXISTS castiq.approvals (
 id text PRIMARY KEY, club_id text NOT NULL, content_id text NOT NULL, revision integer NOT NULL, content_hash text NOT NULL,
 actor_id text NOT NULL, decision text NOT NULL CHECK(decision IN ('approved','feedback')), reason text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,content_id,revision) REFERENCES castiq.revisions(club_id,content_id,revision)
);
CREATE TABLE IF NOT EXISTS castiq.jobs (
 id text PRIMARY KEY, club_id text NOT NULL, content_id text NOT NULL, revision integer NOT NULL,
 idempotency_key text NOT NULL UNIQUE, provider_request_id text NOT NULL, provider_mode text NOT NULL CHECK(provider_mode='demo'),
 payload jsonb NOT NULL, content_hash text NOT NULL, status text NOT NULL, attempt integer NOT NULL DEFAULT 1,
 scheduled_at timestamptz, lease_until timestamptz, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(club_id,content_id,revision) REFERENCES castiq.revisions(club_id,content_id,revision)
);
CREATE INDEX IF NOT EXISTS jobs_due ON castiq.jobs(club_id,status,scheduled_at);
CREATE TABLE IF NOT EXISTS castiq.attempts (
 id text PRIMARY KEY, club_id text NOT NULL, job_id text NOT NULL REFERENCES castiq.jobs(id), attempt integer NOT NULL,
 provider_request_id text NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS castiq.receipts (
 job_id text PRIMARY KEY REFERENCES castiq.jobs(id), club_id text NOT NULL, revision integer NOT NULL,
 kind text NOT NULL CHECK(kind='demo'), provider_post_id text NOT NULL, evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS castiq.audit (
 id text PRIMARY KEY, club_id text NOT NULL, actor_id text NOT NULL, action text NOT NULL, object_id text,
 correlation_id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS castiq.media (
 id text PRIMARY KEY, club_id text NOT NULL, team text NOT NULL, actor_id text NOT NULL, object_key text NOT NULL UNIQUE,
 mime text NOT NULL CHECK(mime='image/webp'), width integer NOT NULL, height integer NOT NULL, byte_size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_tenant ON castiq.media(club_id,team);
CREATE OR REPLACE FUNCTION castiq.prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable history'; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['revisions','approvals','receipts','attempts','audit'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='immutable_'||t AND tgrelid=('castiq.'||t)::regclass) THEN
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON castiq.%I FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation()', 'immutable_'||t,t); END IF; END LOOP; END $$;
CREATE OR REPLACE FUNCTION castiq.freeze_job_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.content_id IS DISTINCT FROM OLD.content_id OR NEW.revision IS DISTINCT FROM OLD.revision OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.provider_request_id IS DISTINCT FROM OLD.provider_request_id OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.provider_mode IS DISTINCT FROM OLD.provider_mode THEN RAISE EXCEPTION 'immutable publication request'; END IF;
 RETURN NEW; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='frozen_job_request' AND tgrelid='castiq.jobs'::regclass) THEN CREATE TRIGGER frozen_job_request BEFORE UPDATE ON castiq.jobs FOR EACH ROW EXECUTE FUNCTION castiq.freeze_job_request(); END IF; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['workspaces','memberships','sessions','revisions','approvals','jobs','attempts','receipts','audit','media'] LOOP EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
-- No public/anon/authenticated policies. Server owns its private connection; provision a restricted server role per deployment.
REVOKE ALL ON ALL TABLES IN SCHEMA castiq FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA castiq FROM PUBLIC;
COMMIT;
