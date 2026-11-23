-- Reserved configuration owner; excluded from every club register and content API.
INSERT INTO castiq.workspaces(club_id,state) VALUES('__platform__','{"club":{"id":"__platform__","name":"Castiq Platform"},"teams":[],"players":[],"users":[],"matches":[],"content":[],"events":[],"connections":[],"rules":{},"activity":[],"v1":{"drafts":{},"audit":[],"sponsorAgreements":[],"weekPlans":[],"weekendReports":[]}}') ON CONFLICT DO NOTHING;
CREATE TABLE castiq.club_integrations (
 club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 provider text NOT NULL CHECK (provider IN ('instagram','facebook','x','sportlink')),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 public_config jsonb NOT NULL DEFAULT '{}', encrypted_config text,
 enabled boolean NOT NULL DEFAULT false,
 updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(club_id,provider)
);
CREATE TABLE castiq.integration_events (
 id uuid PRIMARY KEY, club_id text NOT NULL, provider text NOT NULL,
 actor_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE castiq.media ADD COLUMN label text NOT NULL DEFAULT '';
ALTER TABLE castiq.media ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE castiq.media ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TRIGGER integration_events_immutable BEFORE UPDATE OR DELETE ON castiq.integration_events FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
ALTER TABLE castiq.club_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE castiq.integration_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON castiq.club_integrations,castiq.integration_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON castiq.club_integrations,castiq.integration_events FROM anon; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON castiq.club_integrations,castiq.integration_events FROM authenticated; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='castiq_runtime') THEN
  GRANT SELECT,INSERT,UPDATE ON castiq.club_integrations TO castiq_runtime;
  GRANT SELECT,INSERT ON castiq.integration_events TO castiq_runtime;
  CREATE POLICY runtime_integrations ON castiq.club_integrations TO castiq_runtime USING(true) WITH CHECK(true);
  CREATE POLICY runtime_integration_events ON castiq.integration_events TO castiq_runtime USING(true) WITH CHECK(true);
 END IF;
END $$;
