BEGIN;
-- Preserve immutable club designs, plan snapshots and integration evidence while
-- allowing the privacy transaction to erase the technical personal actor reference.
CREATE FUNCTION castiq.guard_integration_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE actor_column text;
BEGIN
 IF TG_TABLE_SCHEMA='castiq' AND TG_TABLE_NAME IN ('template_versions','template_audit','plan_events','social_events','integration_events') THEN actor_column:='actor_id';
 ELSIF TG_TABLE_SCHEMA='castiq' AND TG_TABLE_NAME='plan_policies' THEN actor_column:='created_by';
 ELSE RAISE EXCEPTION 'immutable history'; END IF;
 IF TG_OP='UPDATE' AND current_setting('castiq.privacy_erasure',true)='on' THEN
  IF (to_jsonb(NEW)->>actor_column) ~ '^erased:[a-f0-9]{64}$'
   AND (to_jsonb(NEW)-actor_column)=(to_jsonb(OLD)-actor_column) THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'immutable history';
END $$;
REVOKE ALL ON FUNCTION castiq.guard_integration_history() FROM PUBLIC;
DROP TRIGGER template_versions_immutable ON castiq.template_versions;
CREATE TRIGGER template_versions_immutable BEFORE UPDATE OR DELETE ON castiq.template_versions FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DROP TRIGGER template_audit_immutable ON castiq.template_audit;
CREATE TRIGGER template_audit_immutable BEFORE UPDATE OR DELETE ON castiq.template_audit FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DROP TRIGGER immutable_plan_policies ON castiq.plan_policies;
CREATE TRIGGER immutable_plan_policies BEFORE UPDATE OR DELETE ON castiq.plan_policies FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DROP TRIGGER immutable_plan_events ON castiq.plan_events;
CREATE TRIGGER immutable_plan_events BEFORE UPDATE OR DELETE ON castiq.plan_events FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DROP TRIGGER immutable_social_events ON castiq.social_events;
CREATE TRIGGER immutable_social_events BEFORE UPDATE OR DELETE ON castiq.social_events FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DROP TRIGGER integration_events_immutable ON castiq.integration_events;
CREATE TRIGGER integration_events_immutable BEFORE UPDATE OR DELETE ON castiq.integration_events FOR EACH ROW EXECUTE FUNCTION castiq.guard_integration_history();
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='castiq_runtime') THEN
  GRANT UPDATE(actor_id) ON castiq.template_versions,castiq.template_audit,castiq.plan_events,castiq.social_events,castiq.integration_events TO castiq_runtime;
  GRANT UPDATE(created_by) ON castiq.plan_policies TO castiq_runtime;
 END IF;
END $$;
COMMIT;
