BEGIN;
-- Person, membership and club content deliberately have no cascading foreign keys.
CREATE TABLE castiq.privacy_accounts (
 actor_id text PRIMARY KEY, email text, status text NOT NULL CHECK(status IN ('registration_pending','active','deletion_pending','deleting')),
 registration_started_at timestamptz NOT NULL DEFAULT now(), registration_completed_at timestamptz,
 auth_created_for_registration boolean NOT NULL DEFAULT false,
 last_conscious_at timestamptz, reliable_activity boolean NOT NULL DEFAULT false,
 transition_announced_at timestamptz, transition_start_at timestamptz,
 deletion_requested_at timestamptz, deletion_due_at timestamptz, deletion_reason text,
 updated_at timestamptz NOT NULL DEFAULT now(), CHECK(deletion_due_at IS NULL OR deletion_requested_at IS NOT NULL)
);
-- Existing identities receive no invented activity or retroactive acceptance.
INSERT INTO castiq.privacy_accounts(actor_id,status,registration_started_at)
 SELECT actor_id,'active',now() FROM castiq.memberships GROUP BY actor_id ON CONFLICT DO NOTHING;
CREATE TABLE castiq.privacy_activity_events (
 actor_id text NOT NULL, event_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('session_start','user_action')),
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,event_id)
);
CREATE TABLE castiq.legal_documents (
 kind text NOT NULL, version text NOT NULL, sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 content text NOT NULL, effective_date date NOT NULL, archived_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,version)
);
CREATE TABLE castiq.legal_acceptances (
 id text PRIMARY KEY, actor_id text NOT NULL, club_id text, scope text NOT NULL CHECK(scope IN ('personal','club')),
 kind text NOT NULL, version text NOT NULL, sha256 text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(),
 representative_confirmed boolean NOT NULL DEFAULT false,
 FOREIGN KEY(kind,version) REFERENCES castiq.legal_documents(kind,version),
 CHECK((scope='club' AND club_id IS NOT NULL AND representative_confirmed) OR (scope='personal' AND club_id IS NULL)),
 UNIQUE(actor_id,club_id,scope,kind,version)
);
CREATE UNIQUE INDEX legal_personal_acceptance ON castiq.legal_acceptances(actor_id,kind,version) WHERE scope='personal';
CREATE TABLE castiq.privacy_cases (
 id text PRIMARY KEY, kind text NOT NULL, actor_id text, controller_club_id text,
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','verification','in_progress','awaiting_controller','closed')),
 received_at timestamptz NOT NULL, initial_due_at timestamptz NOT NULL, due_at timestamptz NOT NULL,
 assigned_to text, extension_reason text, extended_at timestamptz, closed_at timestamptz, outcome text,
 metadata_expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.privacy_case_details (
 case_id text PRIMARY KEY REFERENCES castiq.privacy_cases(id) ON DELETE CASCADE,
 email text NOT NULL, message text NOT NULL, verification_note text, expires_at timestamptz
);
CREATE TABLE castiq.privacy_case_actions (
 id text PRIMARY KEY, case_id text NOT NULL REFERENCES castiq.privacy_cases(id) ON DELETE CASCADE,
 actor_id text NOT NULL, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.privacy_holds (
 id text PRIMARY KEY, dataset text NOT NULL, subject_ref text NOT NULL, responsible text NOT NULL,
 reason text NOT NULL, review_at timestamptz NOT NULL, ends_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.privacy_deletions (
 id text PRIMARY KEY, actor_id text UNIQUE, subject_ref text NOT NULL UNIQUE, reason text NOT NULL,
 status text NOT NULL CHECK(status IN ('blocked','processing','failed','completed','recovered')),
 blocked_at timestamptz NOT NULL, due_at timestamptz NOT NULL, completed_at timestamptz, recovered_at timestamptz, evidence_expires_at timestamptz,
 steps jsonb NOT NULL DEFAULT '{}', error_code text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE castiq.privacy_mail_failures (idempotency_key text PRIMARY KEY, actor_id text, template_key text NOT NULL, error_code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE castiq.privacy_retention_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), destructive_enabled boolean NOT NULL DEFAULT false,
 dry_run_verified_at timestamptz, restore_verified_at timestamptz, transition_verified_at timestamptz,
 provider_retention_verified_at timestamptz, verified_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO castiq.privacy_retention_control(singleton) VALUES(true);
CREATE TABLE castiq.privacy_support_cases (
 id text PRIMARY KEY, mailbox_scope text NOT NULL, provider_message_refs jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL CHECK(status IN ('open','closed','purge_pending','purged','failed')),
 closed_at timestamptz, purge_due_at timestamptz, purged_at timestamptz, provider_receipt text, error_code text
);
CREATE TABLE castiq.privacy_backups (
 id text PRIMARY KEY, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 storage_ref text NOT NULL UNIQUE, status text NOT NULL CHECK(status IN ('available','purge_pending','purged','failed')),
 purged_at timestamptz, provider_receipt text, CHECK(expires_at<=created_at+interval '180 days')
);
CREATE TABLE castiq.privacy_restore_runs (
 id text PRIMARY KEY, backup_id text NOT NULL, status text NOT NULL CHECK(status IN ('quarantine','reapplied','verified','released','failed')),
 started_at timestamptz NOT NULL, ledger_checked_at timestamptz, evidence jsonb NOT NULL DEFAULT '{}', released_at timestamptz
);
CREATE INDEX privacy_accounts_due ON castiq.privacy_accounts(status,deletion_due_at,last_conscious_at);
CREATE INDEX privacy_case_deadlines ON castiq.privacy_cases(status,due_at);
CREATE OR REPLACE FUNCTION castiq.prevent_legal_document_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable legal archive'; END $$;
CREATE TRIGGER immutable_legal_documents BEFORE UPDATE OR DELETE ON castiq.legal_documents FOR EACH ROW EXECUTE FUNCTION castiq.prevent_legal_document_mutation();
-- Privacy erasure may replace only the technical actor reference. Frozen club payloads remain immutable.
CREATE OR REPLACE FUNCTION castiq.prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' AND current_setting('castiq.privacy_erasure',true)='on'
 AND NEW.actor_id LIKE 'erased:%' AND (to_jsonb(NEW)-'actor_id')=(to_jsonb(OLD)-'actor_id') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'immutable history'; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['privacy_accounts','privacy_activity_events','legal_documents','legal_acceptances','privacy_cases','privacy_case_details','privacy_case_actions','privacy_holds','privacy_deletions','privacy_mail_failures','privacy_retention_control','privacy_support_cases','privacy_backups','privacy_restore_runs'] LOOP EXECUTE format('ALTER TABLE castiq.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA castiq FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA castiq FROM PUBLIC;
COMMIT;
