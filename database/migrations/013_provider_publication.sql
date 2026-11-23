ALTER TABLE castiq.jobs DROP CONSTRAINT jobs_provider_mode_check;
ALTER TABLE castiq.jobs ADD CONSTRAINT jobs_provider_mode_check CHECK(provider_mode IN ('demo','provider'));
ALTER TABLE castiq.receipts DROP CONSTRAINT receipts_kind_check;
ALTER TABLE castiq.receipts ADD CONSTRAINT receipts_kind_check CHECK(kind IN ('demo','provider'));
CREATE TABLE castiq.publication_dispatches (
 job_id text PRIMARY KEY REFERENCES castiq.jobs(id), club_id text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('instagram','facebook','x')), account_id text NOT NULL,
 connection_version integer NOT NULL, content_hash text NOT NULL,
 state jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION castiq.freeze_publication_dispatch() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF (to_jsonb(NEW)-'state'-'updated_at')<>(to_jsonb(OLD)-'state'-'updated_at') THEN RAISE EXCEPTION 'immutable publication dispatch identity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_dispatch BEFORE UPDATE ON castiq.publication_dispatches FOR EACH ROW EXECUTE FUNCTION castiq.freeze_publication_dispatch();
ALTER TABLE castiq.publication_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON castiq.publication_dispatches FROM PUBLIC;
REVOKE ALL ON FUNCTION castiq.freeze_publication_dispatch() FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON castiq.publication_dispatches FROM anon; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON castiq.publication_dispatches FROM authenticated; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='castiq_runtime') THEN
  GRANT SELECT,INSERT,UPDATE ON castiq.publication_dispatches TO castiq_runtime;
  CREATE POLICY runtime_dispatches ON castiq.publication_dispatches TO castiq_runtime USING(true) WITH CHECK(true);
 END IF;
END $$;
