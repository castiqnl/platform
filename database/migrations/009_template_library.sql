BEGIN;
-- Private central designs. End users never access these tables through the Data API.
CREATE TABLE castiq.templates (
 id text PRIMARY KEY,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 90),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=280),
 family text NOT NULL,
 post_type text NOT NULL CHECK(post_type IN ('match','result','news','lineup')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 enabled boolean NOT NULL DEFAULT false,
 audience text NOT NULL DEFAULT 'all' CHECK(audience IN ('all','selected')),
 is_default boolean NOT NULL DEFAULT false,
 published_version integer,
 draft_layouts jsonb,
 draft_saved_at timestamptz,
 draft_based_on integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR published_version IS NOT NULL),
 CHECK(NOT is_default OR (enabled AND published_version IS NOT NULL)),
 CHECK(draft_layouts IS NULL OR (jsonb_typeof(draft_layouts)='object' AND octet_length(draft_layouts::text)<=524288))
);
CREATE UNIQUE INDEX templates_default_post_type ON castiq.templates(post_type) WHERE is_default;
CREATE TABLE castiq.template_versions (
 template_id text NOT NULL REFERENCES castiq.templates(id),
 number integer NOT NULL CHECK(number>0),
 layouts jsonb NOT NULL CHECK(jsonb_typeof(layouts)='object' AND octet_length(layouts::text)<=524288),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 published_at timestamptz NOT NULL DEFAULT now(),
 actor_id text NOT NULL,
 PRIMARY KEY(template_id,number)
);
ALTER TABLE castiq.templates ADD CONSTRAINT templates_published_version FOREIGN KEY(id,published_version) REFERENCES castiq.template_versions(template_id,number) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE castiq.template_assignments (
 template_id text NOT NULL REFERENCES castiq.templates(id),
 club_id text NOT NULL REFERENCES castiq.workspaces(club_id),
 PRIMARY KEY(template_id,club_id)
);
CREATE INDEX template_assignments_club ON castiq.template_assignments(club_id,template_id);
CREATE TABLE castiq.template_audit (
 id text PRIMARY KEY,
 template_id text NOT NULL REFERENCES castiq.templates(id),
 actor_id text NOT NULL,
 action text NOT NULL,
 revision integer NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX template_audit_history ON castiq.template_audit(template_id,created_at DESC);
CREATE TRIGGER template_versions_immutable BEFORE UPDATE OR DELETE ON castiq.template_versions FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
CREATE TRIGGER template_audit_immutable BEFORE UPDATE OR DELETE ON castiq.template_audit FOR EACH ROW EXECUTE FUNCTION castiq.prevent_history_mutation();
DO $$ DECLARE tab text; DECLARE target_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['templates','template_versions','template_assignments','template_audit'] LOOP
  EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON castiq.%I FROM PUBLIC',tab);
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=target_role) THEN EXECUTE format('REVOKE ALL ON castiq.%I FROM %I',tab,target_role); END IF;
  END LOOP;
 END LOOP;
END $$;
-- Match the established private server role. It receives no DDL, table ownership,
-- broad default grants or permission to rewrite immutable versions/audit rows.
DO $$ DECLARE tab text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='castiq_runtime') THEN
  GRANT SELECT,INSERT,UPDATE ON castiq.templates TO castiq_runtime;
  GRANT SELECT,INSERT ON castiq.template_versions,castiq.template_audit TO castiq_runtime;
  GRANT SELECT,INSERT,DELETE ON castiq.template_assignments TO castiq_runtime;
  FOREACH tab IN ARRAY ARRAY['templates','template_versions','template_assignments','template_audit'] LOOP
   EXECUTE format('CREATE POLICY castiq_runtime_server ON castiq.%I TO castiq_runtime USING(true) WITH CHECK(true)',tab);
  END LOOP;
 END IF;
END $$;
COMMIT;
