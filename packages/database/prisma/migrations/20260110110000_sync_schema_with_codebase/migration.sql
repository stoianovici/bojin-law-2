-- Idempotent migration to sync schema with codebase
-- Safe to run on both fresh databases and production with partial schema drift

-- ============================================================================
-- EXTENSIONS (idempotent)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ENUMS - Create new ones, add missing values to existing ones
-- ============================================================================

-- CaseSyncStatus: Production has Synced/Error, schema wants Completed/Failed
-- Add the schema values to production (don't remove old ones to preserve data)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CaseSyncStatus') THEN
    CREATE TYPE "CaseSyncStatus" AS ENUM ('Pending', 'Syncing', 'Completed', 'Failed');
  ELSE
    -- Add missing values if enum exists
    BEGIN
      ALTER TYPE "CaseSyncStatus" ADD VALUE IF NOT EXISTS 'Completed';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE "CaseSyncStatus" ADD VALUE IF NOT EXISTS 'Failed';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- SuggestionType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionType') THEN
    CREATE TYPE "SuggestionType" AS ENUM ('MorningBriefing', 'TaskSuggestion', 'PatternMatch', 'DeadlineWarning', 'DocumentCheck', 'FollowUp', 'RiskAlert');
  END IF;
END $$;

-- SuggestionCategory
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionCategory') THEN
    CREATE TYPE "SuggestionCategory" AS ENUM ('Task', 'Communication', 'Document', 'Calendar', 'Compliance');
  END IF;
END $$;

-- SuggestionPriority
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionPriority') THEN
    CREATE TYPE "SuggestionPriority" AS ENUM ('Low', 'Normal', 'High', 'Urgent');
  END IF;
END $$;

-- SuggestionStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SuggestionStatus') THEN
    CREATE TYPE "SuggestionStatus" AS ENUM ('Pending', 'Accepted', 'Dismissed', 'Expired', 'AutoApplied');
  END IF;
END $$;

-- BulkRecipientType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BulkRecipientType') THEN
    CREATE TYPE "BulkRecipientType" AS ENUM ('CaseClients', 'CaseTeam', 'AllClients', 'CustomList', 'CaseTypeClients');
  END IF;
END $$;

-- ClassificationReason
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassificationReason') THEN
    CREATE TYPE "ClassificationReason" AS ENUM ('MultiCaseConflict', 'LowConfidence', 'NoMatchingCase', 'CourtNoReference', 'UnknownContact');
  END IF;
END $$;

-- HistoricalEmailSyncStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HistoricalEmailSyncStatus') THEN
    CREATE TYPE "HistoricalEmailSyncStatus" AS ENUM ('Pending', 'InProgress', 'Completed', 'Failed');
  END IF;
END $$;

-- CasePhase
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CasePhase') THEN
    CREATE TYPE "CasePhase" AS ENUM ('ConsultantaInitiala', 'Negociere', 'DueDiligence', 'PrimaInstanta', 'Apel', 'Executare', 'Mediere', 'Arbitraj', 'Inchis');
  END IF;
END $$;

-- CaseChapterEventType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CaseChapterEventType') THEN
    CREATE TYPE "CaseChapterEventType" AS ENUM ('Document', 'Email', 'Task', 'CourtOutcome', 'ContractSigned', 'Negotiation', 'Deadline', 'ClientDecision', 'TeamChange', 'StatusChange', 'Milestone');
  END IF;
END $$;

-- Add missing values to existing enums
DO $$ BEGIN ALTER TYPE "CaseActorRole" ADD VALUE IF NOT EXISTS 'Other'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EmailClassificationState" ADD VALUE IF NOT EXISTS 'ClientInbox'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ExportStatus" ADD VALUE IF NOT EXISTS 'Expired'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MorningBriefingReady'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AISuggestionCreated'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BulkCommunicationCompleted'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CommunicationExportReady'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TaskTypeEnum" ADD VALUE IF NOT EXISTS 'Hearing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TaskTypeEnum" ADD VALUE IF NOT EXISTS 'LegalDeadline'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TaskTypeEnum" ADD VALUE IF NOT EXISTS 'Reminder'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TaskTypeEnum" ADD VALUE IF NOT EXISTS 'GeneralTask'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ExportFormat: add JSON and DOCX if missing
DO $$ BEGIN ALTER TYPE "ExportFormat" ADD VALUE IF NOT EXISTS 'JSON'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "ExportFormat" ADD VALUE IF NOT EXISTS 'DOCX'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PrivacyLevel: add AttorneyOnly and PartnerOnly if missing
DO $$ BEGIN ALTER TYPE "PrivacyLevel" ADD VALUE IF NOT EXISTS 'AttorneyOnly'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "PrivacyLevel" ADD VALUE IF NOT EXISTS 'PartnerOnly'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TemplateCategory: add new values
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'ClientUpdate'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'AppointmentReminder'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'DocumentRequest'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'InvoiceReminder'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'CaseOpening'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'CaseClosing'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "TemplateCategory" ADD VALUE IF NOT EXISTS 'General'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DROP foreign keys that will be recreated (idempotent)
-- ============================================================================
ALTER TABLE "bulk_communications" DROP CONSTRAINT IF EXISTS "bulk_communications_case_id_fkey";
ALTER TABLE "bulk_communications" DROP CONSTRAINT IF EXISTS "bulk_communications_template_id_fkey";
ALTER TABLE "communication_entries" DROP CONSTRAINT IF EXISTS "communication_entries_case_id_fkey";
ALTER TABLE "communication_exports" DROP CONSTRAINT IF EXISTS "communication_exports_case_id_fkey";

-- ============================================================================
-- DROP indexes (idempotent)
-- ============================================================================
DROP INDEX IF EXISTS "emails_is_private_idx";

-- ============================================================================
-- ALTER TABLE - Add columns (idempotent using IF NOT EXISTS pattern)
-- ============================================================================

-- cases.sync_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'sync_status') THEN
    ALTER TABLE "cases" ADD COLUMN "sync_status" "CaseSyncStatus" NOT NULL DEFAULT 'Pending';
  END IF;
END $$;

-- case_briefings columns
ALTER TABLE "case_briefings" ADD COLUMN IF NOT EXISTS "corrections_applied_at" TIMESTAMPTZ(6);
ALTER TABLE "case_briefings" ADD COLUMN IF NOT EXISTS "last_corrected_by" TEXT;
ALTER TABLE "case_briefings" ADD COLUMN IF NOT EXISTS "user_corrections" JSONB;

-- case_documents.client_id
ALTER TABLE "case_documents" ADD COLUMN IF NOT EXISTS "client_id" TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'case_documents' AND column_name = 'case_id' AND is_nullable = 'NO') THEN
    ALTER TABLE "case_documents" ALTER COLUMN "case_id" DROP NOT NULL;
  END IF;
END $$;

-- emails.client_id
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "client_id" TEXT;

-- legacy_import_sessions columns
ALTER TABLE "legacy_import_sessions" ADD COLUMN IF NOT EXISTS "cleanup_scheduled_at" TIMESTAMPTZ(6);
ALTER TABLE "legacy_import_sessions" ADD COLUMN IF NOT EXISTS "extraction_progress" JSONB;
ALTER TABLE "legacy_import_sessions" ADD COLUMN IF NOT EXISTS "last_snapshot_at" TIMESTAMPTZ(6);

-- bulk_communications new columns and changes
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "html_body" TEXT;
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "recipient_filter" JSONB;
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "recipient_type" VARCHAR(50);
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "recipients" JSONB;
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ(6);
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "sent_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bulk_communications" ADD COLUMN IF NOT EXISTS "total_recipients" INTEGER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bulk_communications' AND column_name = 'case_id' AND is_nullable = 'NO') THEN
    ALTER TABLE "bulk_communications" ALTER COLUMN "case_id" DROP NOT NULL;
  END IF;
END $$;

-- bulk_communication_logs.status - change from enum to varchar if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bulk_communication_logs' AND column_name = 'status' AND data_type = 'USER-DEFINED') THEN
    ALTER TABLE "bulk_communication_logs" ALTER COLUMN "status" TYPE VARCHAR(20) USING status::text;
  END IF;
END $$;

-- communication_attachments type changes
DO $$
BEGIN
  ALTER TABLE "communication_attachments" ALTER COLUMN "file_name" TYPE VARCHAR(500);
  ALTER TABLE "communication_attachments" ALTER COLUMN "mime_type" TYPE VARCHAR(200);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- CREATE TABLES (idempotent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "case_notes" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "color" VARCHAR(20) NOT NULL DEFAULT 'yellow',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_suggestions" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT,
    "type" "SuggestionType" NOT NULL,
    "category" "SuggestionCategory" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "suggested_action" TEXT,
    "action_payload" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'Normal',
    "context" JSONB,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'Pending',
    "dismissed_at" TIMESTAMPTZ(6),
    "dismiss_reason" VARCHAR(500),
    "accepted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_action_patterns" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pattern_type" VARCHAR(100) NOT NULL,
    "trigger_context" JSONB NOT NULL,
    "action_sequence" JSONB NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "last_occurrence" TIMESTAMPTZ(6) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_action_patterns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "document_completeness_checks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "document_type" VARCHAR(100) NOT NULL,
    "missing_items" JSONB NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "check_type" VARCHAR(50) NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "document_completeness_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "suggestion_feedback" (
    "id" TEXT NOT NULL,
    "suggestion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "modified_action" JSONB,
    "feedback_reason" VARCHAR(500),
    "response_time_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suggestion_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "email_classification_logs" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "action" "ClassificationAction" NOT NULL,
    "from_case_id" TEXT,
    "to_case_id" TEXT,
    "was_automatic" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "match_type" "ClassificationMatchType",
    "correction_reason" TEXT,
    "performed_by" TEXT NOT NULL,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_classification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pending_classifications" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "reason" "ClassificationReason" NOT NULL,
    "suggested_cases" JSONB NOT NULL DEFAULT '[]',
    "detected_references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pending_classifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "historical_email_sync_jobs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "contact_email" VARCHAR(320) NOT NULL,
    "contact_role" VARCHAR(50) NOT NULL DEFAULT 'Client',
    "status" "HistoricalEmailSyncStatus" NOT NULL DEFAULT 'Pending',
    "total_emails" INTEGER,
    "synced_emails" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "historical_email_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "context_profiles" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "max_tokens" INTEGER NOT NULL DEFAULT 4000,
    "summarization_level" VARCHAR(20) NOT NULL DEFAULT 'standard',
    "target_context" VARCHAR(30) NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "context_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "word_content_templates" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "case_type" VARCHAR(50),
    "document_type" VARCHAR(50) NOT NULL DEFAULT 'Other',
    "share_point_item_id" VARCHAR(255) NOT NULL,
    "share_point_path" TEXT NOT NULL,
    "share_point_web_url" TEXT,
    "content_text" TEXT,
    "content_hash" VARCHAR(64),
    "last_synced" TIMESTAMPTZ(6),
    "category" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "word_content_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "word_template_usages" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT,
    "document_id" TEXT,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "word_template_usages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "case_chapters" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "phase" "CasePhase" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_version_hash" VARCHAR(64) NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "case_chapters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "case_chapter_events" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "event_type" "CaseChapterEventType" NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_chapter_events_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- CREATE INDEXES (idempotent)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "case_notes_case_id_idx" ON "case_notes"("case_id");
CREATE INDEX IF NOT EXISTS "case_notes_firm_id_idx" ON "case_notes"("firm_id");
CREATE INDEX IF NOT EXISTS "case_notes_author_id_idx" ON "case_notes"("author_id");

CREATE INDEX IF NOT EXISTS "ai_suggestions_user_id_status_idx" ON "ai_suggestions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "ai_suggestions_case_id_idx" ON "ai_suggestions"("case_id");
CREATE INDEX IF NOT EXISTS "ai_suggestions_firm_id_idx" ON "ai_suggestions"("firm_id");
CREATE INDEX IF NOT EXISTS "ai_suggestions_type_idx" ON "ai_suggestions"("type");
CREATE INDEX IF NOT EXISTS "ai_suggestions_created_at_idx" ON "ai_suggestions"("created_at");
CREATE INDEX IF NOT EXISTS "ai_suggestions_expires_at_idx" ON "ai_suggestions"("expires_at");

CREATE INDEX IF NOT EXISTS "user_action_patterns_firm_id_idx" ON "user_action_patterns"("firm_id");
CREATE INDEX IF NOT EXISTS "user_action_patterns_user_id_idx" ON "user_action_patterns"("user_id");
CREATE INDEX IF NOT EXISTS "user_action_patterns_confidence_idx" ON "user_action_patterns"("confidence");
CREATE UNIQUE INDEX IF NOT EXISTS "user_action_patterns_user_id_pattern_type_key" ON "user_action_patterns"("user_id", "pattern_type");

CREATE INDEX IF NOT EXISTS "document_completeness_checks_document_id_idx" ON "document_completeness_checks"("document_id");
CREATE INDEX IF NOT EXISTS "document_completeness_checks_firm_id_idx" ON "document_completeness_checks"("firm_id");
CREATE INDEX IF NOT EXISTS "document_completeness_checks_is_resolved_idx" ON "document_completeness_checks"("is_resolved");

CREATE INDEX IF NOT EXISTS "suggestion_feedback_suggestion_id_idx" ON "suggestion_feedback"("suggestion_id");
CREATE INDEX IF NOT EXISTS "suggestion_feedback_user_id_idx" ON "suggestion_feedback"("user_id");
CREATE INDEX IF NOT EXISTS "suggestion_feedback_firm_id_idx" ON "suggestion_feedback"("firm_id");
CREATE INDEX IF NOT EXISTS "suggestion_feedback_action_idx" ON "suggestion_feedback"("action");

CREATE INDEX IF NOT EXISTS "email_classification_logs_email_id_idx" ON "email_classification_logs"("email_id");
CREATE INDEX IF NOT EXISTS "email_classification_logs_from_case_id_idx" ON "email_classification_logs"("from_case_id");
CREATE INDEX IF NOT EXISTS "email_classification_logs_to_case_id_idx" ON "email_classification_logs"("to_case_id");
CREATE INDEX IF NOT EXISTS "email_classification_logs_firm_id_idx" ON "email_classification_logs"("firm_id");
CREATE INDEX IF NOT EXISTS "email_classification_logs_performed_at_idx" ON "email_classification_logs"("performed_at");
CREATE INDEX IF NOT EXISTS "email_classification_logs_action_idx" ON "email_classification_logs"("action");

CREATE UNIQUE INDEX IF NOT EXISTS "pending_classifications_email_id_key" ON "pending_classifications"("email_id");
CREATE INDEX IF NOT EXISTS "pending_classifications_firm_id_idx" ON "pending_classifications"("firm_id");
CREATE INDEX IF NOT EXISTS "pending_classifications_is_resolved_idx" ON "pending_classifications"("is_resolved");
CREATE INDEX IF NOT EXISTS "pending_classifications_reason_idx" ON "pending_classifications"("reason");
CREATE INDEX IF NOT EXISTS "pending_classifications_created_at_idx" ON "pending_classifications"("created_at");

CREATE INDEX IF NOT EXISTS "historical_email_sync_jobs_case_id_idx" ON "historical_email_sync_jobs"("case_id");
CREATE INDEX IF NOT EXISTS "historical_email_sync_jobs_status_idx" ON "historical_email_sync_jobs"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "historical_email_sync_jobs_case_id_contact_email_key" ON "historical_email_sync_jobs"("case_id", "contact_email");

CREATE INDEX IF NOT EXISTS "context_profiles_firm_id_idx" ON "context_profiles"("firm_id");
CREATE UNIQUE INDEX IF NOT EXISTS "context_profiles_firm_id_code_key" ON "context_profiles"("firm_id", "code");

CREATE INDEX IF NOT EXISTS "word_content_templates_firm_id_idx" ON "word_content_templates"("firm_id");
CREATE INDEX IF NOT EXISTS "word_content_templates_case_type_idx" ON "word_content_templates"("case_type");
CREATE INDEX IF NOT EXISTS "word_content_templates_document_type_idx" ON "word_content_templates"("document_type");
CREATE INDEX IF NOT EXISTS "word_content_templates_category_idx" ON "word_content_templates"("category");

CREATE INDEX IF NOT EXISTS "word_template_usages_template_id_idx" ON "word_template_usages"("template_id");
CREATE INDEX IF NOT EXISTS "word_template_usages_user_id_idx" ON "word_template_usages"("user_id");

CREATE INDEX IF NOT EXISTS "case_chapters_case_id_idx" ON "case_chapters"("case_id");
CREATE INDEX IF NOT EXISTS "case_chapters_firm_id_idx" ON "case_chapters"("firm_id");
CREATE INDEX IF NOT EXISTS "case_chapters_phase_idx" ON "case_chapters"("phase");
CREATE INDEX IF NOT EXISTS "case_chapters_is_stale_idx" ON "case_chapters"("is_stale");
CREATE UNIQUE INDEX IF NOT EXISTS "case_chapters_case_id_phase_key" ON "case_chapters"("case_id", "phase");

CREATE INDEX IF NOT EXISTS "case_chapter_events_chapter_id_idx" ON "case_chapter_events"("chapter_id");
CREATE INDEX IF NOT EXISTS "case_chapter_events_event_type_idx" ON "case_chapter_events"("event_type");
CREATE INDEX IF NOT EXISTS "case_chapter_events_occurred_at_idx" ON "case_chapter_events"("occurred_at");

CREATE INDEX IF NOT EXISTS "bulk_communication_logs_status_idx" ON "bulk_communication_logs"("status");
CREATE INDEX IF NOT EXISTS "case_documents_client_id_idx" ON "case_documents"("client_id");
CREATE INDEX IF NOT EXISTS "communication_templates_is_active_idx" ON "communication_templates"("is_active");
CREATE INDEX IF NOT EXISTS "emails_client_id_idx" ON "emails"("client_id");
CREATE INDEX IF NOT EXISTS "extracted_documents_session_id_batch_id_idx" ON "extracted_documents"("session_id", "batch_id");
CREATE INDEX IF NOT EXISTS "extracted_documents_session_id_status_idx" ON "extracted_documents"("session_id", "status");

-- ============================================================================
-- ADD FOREIGN KEYS (idempotent)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "emails" ADD CONSTRAINT "emails_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_action_patterns" ADD CONSTRAINT "user_action_patterns_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_action_patterns" ADD CONSTRAINT "user_action_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "document_completeness_checks" ADD CONSTRAINT "document_completeness_checks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "suggestion_feedback" ADD CONSTRAINT "suggestion_feedback_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "ai_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "communication_entries" ADD CONSTRAINT "communication_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "communication_entries" ADD CONSTRAINT "communication_entries_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "communication_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bulk_communications" ADD CONSTRAINT "bulk_communications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "communication_exports" ADD CONSTRAINT "communication_exports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_from_case_id_fkey" FOREIGN KEY ("from_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_to_case_id_fkey" FOREIGN KEY ("to_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_classifications" ADD CONSTRAINT "pending_classifications_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_classifications" ADD CONSTRAINT "pending_classifications_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "pending_classifications" ADD CONSTRAINT "pending_classifications_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "historical_email_sync_jobs" ADD CONSTRAINT "historical_email_sync_jobs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "context_profiles" ADD CONSTRAINT "context_profiles_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "word_content_templates" ADD CONSTRAINT "word_content_templates_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "word_content_templates" ADD CONSTRAINT "word_content_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "word_template_usages" ADD CONSTRAINT "word_template_usages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "word_content_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_chapters" ADD CONSTRAINT "case_chapters_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_chapters" ADD CONSTRAINT "case_chapters_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "case_chapter_events" ADD CONSTRAINT "case_chapter_events_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "case_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
