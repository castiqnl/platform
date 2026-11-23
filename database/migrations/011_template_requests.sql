BEGIN;
-- Tenant-scoped design requests. Browser roles have no direct Data API access.
CREATE TABLE castiq.template_requests (
 id uuid PRIMARY KEY,
 club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 70),
 brief text NOT NULL CHECK(length(brief)<=1500),
 status text NOT NULL DEFAULT 'Nieuw' CHECK(status IN ('Nieuw','In behandeling','Gereed','Afgewezen')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 template_id text REFERENCES castiq.templates(id),
 review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=1500),
 created_by text NOT NULL,
 updated_by text NOT NULL,
 reviewed_by text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'Gereed' OR template_id IS NOT NULL)
);
CREATE INDEX template_requests_club_created ON castiq.template_requests(club_id,created_at DESC,id);
CREATE INDEX template_requests_status_created ON castiq.template_requests(status,created_at DESC,id);
CREATE TABLE castiq.template_request_events (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES castiq.template_requests(id),
 actor_id text NOT NULL,
 action text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX template_request_events_history ON castiq.template_request_events(request_id,created_at,id);
-- Only the erasure transaction may replace an actor reference, never the event payload.
CREATE FUNCTION castiq.guard_template_request_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND current_setting('castiq.privacy_erasure',true)='on' THEN
  IF (to_jsonb(NEW)->>'actor_id') ~ '^erased:[a-f0-9]{64}$'
   AND (to_jsonb(NEW)-'actor_id')=(to_jsonb(OLD)-'actor_id') THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'immutable history';
END $$;
REVOKE ALL ON FUNCTION castiq.guard_template_request_event() FROM PUBLIC;
CREATE TRIGGER template_request_events_immutable BEFORE UPDATE OR DELETE ON castiq.template_request_events FOR EACH ROW EXECUTE FUNCTION castiq.guard_template_request_event();
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['template_requests','template_request_events'] LOOP
  EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON castiq.%I FROM PUBLIC',tab);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM anon',tab); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM authenticated',tab); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='castiq_runtime') THEN
   IF tab='template_requests' THEN EXECUTE format('GRANT SELECT,INSERT,UPDATE ON castiq.%I TO castiq_runtime',tab);
   ELSE EXECUTE format('GRANT SELECT,INSERT ON castiq.%I TO castiq_runtime',tab); EXECUTE format('GRANT UPDATE(actor_id) ON castiq.%I TO castiq_runtime',tab); END IF;
   EXECUTE format('CREATE POLICY server_access ON castiq.%I TO castiq_runtime USING(true) WITH CHECK(true)',tab);
  END IF;
 END LOOP;
END $$;
COMMIT;
