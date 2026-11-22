BEGIN;
CREATE TABLE castiq.mail_configuration (
 id integer PRIMARY KEY CHECK(id=1), version integer NOT NULL DEFAULT 1,
 from_email text NOT NULL DEFAULT '', from_name text NOT NULL DEFAULT 'Castiq', reply_to text NOT NULL DEFAULT '',
 encrypted_api_key text, encrypted_webhook_secret text, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.mail_templates (
 template_key text NOT NULL, version integer NOT NULL, document jsonb NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(template_key,version)
);
CREATE OR REPLACE FUNCTION castiq.prevent_mail_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable mail history'; END $$;
CREATE TRIGGER immutable_mail_templates BEFORE UPDATE OR DELETE ON castiq.mail_templates FOR EACH ROW EXECUTE FUNCTION castiq.prevent_mail_history_mutation();
CREATE TABLE castiq.mail_outbox (
 id uuid PRIMARY KEY, idempotency_key text NOT NULL UNIQUE, actor_id text, club_id text,
 template_key text NOT NULL, template_version integer NOT NULL,
 payload jsonb NOT NULL, payload_sha256 text NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','processing','accepted','delivered','bounced','complained','failed','unconfirmed','blocked')),
 attempt integer NOT NULL DEFAULT 0, provider_message_id text UNIQUE, first_attempt_at timestamptz, lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_outbox_due ON castiq.mail_outbox(status,next_attempt_at);
CREATE INDEX mail_outbox_actor ON castiq.mail_outbox(actor_id);
CREATE TABLE castiq.mail_receipts (
 event_id text PRIMARY KEY, outbox_id uuid NOT NULL REFERENCES castiq.mail_outbox(id), provider_message_id text NOT NULL,
 event_type text NOT NULL, provider_created_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION castiq.guard_mail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' AND coalesce(current_setting('castiq.mail_erasure_actor',true),'')<>'' AND EXISTS(SELECT 1 FROM castiq.mail_outbox WHERE id=OLD.outbox_id AND actor_id=current_setting('castiq.mail_erasure_actor',true)) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'immutable mail receipt'; END $$;
CREATE TRIGGER immutable_mail_receipts BEFORE UPDATE OR DELETE ON castiq.mail_receipts FOR EACH ROW EXECUTE FUNCTION castiq.guard_mail_receipt();
CREATE TABLE castiq.mail_admin_audit (
 id uuid PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, template_key text, version integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_mail_admin_audit BEFORE UPDATE OR DELETE ON castiq.mail_admin_audit FOR EACH ROW EXECUTE FUNCTION castiq.prevent_mail_history_mutation();
CREATE OR REPLACE FUNCTION castiq.freeze_mail_payload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN
 IF coalesce(current_setting('castiq.mail_erasure_actor',true),'')<>'' AND OLD.actor_id=current_setting('castiq.mail_erasure_actor',true) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'mail deletion requires scoped erasure'; END IF;
 -- Bind an absent sender once before the first network attempt; the rest stays frozen.
 IF OLD.first_attempt_at IS NULL AND OLD.payload->'from'='null'::jsonb AND jsonb_typeof(NEW.payload->'from')='string' AND (NEW.payload-'from')=(OLD.payload-'from') AND NEW.idempotency_key=OLD.idempotency_key AND NEW.template_key=OLD.template_key AND NEW.template_version=OLD.template_version THEN RETURN NEW; END IF;
 IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.template_key IS DISTINCT FROM OLD.template_key OR NEW.template_version IS DISTINCT FROM OLD.template_version OR NEW.payload IS DISTINCT FROM OLD.payload OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256 THEN RAISE EXCEPTION 'immutable mail request'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER frozen_mail_request BEFORE UPDATE OR DELETE ON castiq.mail_outbox FOR EACH ROW EXECUTE FUNCTION castiq.freeze_mail_payload();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['mail_configuration','mail_templates','mail_outbox','mail_receipts','mail_admin_audit'] LOOP EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON castiq.%I FROM PUBLIC',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION castiq.freeze_mail_payload(),castiq.guard_mail_receipt(),castiq.prevent_mail_history_mutation() FROM PUBLIC;
COMMIT;
