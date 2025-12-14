-- Add Communication Hub tables (Story 5.5)
-- Note: Using IF NOT EXISTS to handle partial migrations

-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "CommunicationChannel" AS ENUM ('Email', 'InternalNote', 'WhatsApp', 'Phone', 'Meeting', 'SMS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CommunicationDirection" AS ENUM ('Inbound', 'Outbound', 'Internal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PrivacyLevel" AS ENUM ('Normal', 'Confidential', 'HighlyConfidential');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV', 'ZIP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ExportStatus" AS ENUM ('Processing', 'Completed', 'Failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TemplateCategory" AS ENUM ('Legal', 'Administrative', 'ClientCommunication', 'InternalMemo', 'CourtFiling', 'Contract');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BulkCommunicationStatus" AS ENUM ('Draft', 'Scheduled', 'InProgress', 'Completed', 'PartiallyFailed', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BulkLogStatus" AS ENUM ('Pending', 'Sent', 'Failed', 'Bounced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable communication_entries
CREATE TABLE IF NOT EXISTS "communication_entries" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "channel_type" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "sender_id" TEXT NOT NULL,
    "sender_name" VARCHAR(200) NOT NULL,
    "sender_email" VARCHAR(255),
    "recipients" JSONB NOT NULL,
    "external_id" VARCHAR(255),
    "parent_id" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "privacy_level" "PrivacyLevel" NOT NULL DEFAULT 'Normal',
    "allowed_viewers" TEXT[],
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "communication_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable communication_attachments
CREATE TABLE IF NOT EXISTS "communication_attachments" (
    "id" TEXT NOT NULL,
    "communication_entry_id" TEXT NOT NULL,
    "document_id" TEXT,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable communication_exports
CREATE TABLE IF NOT EXISTS "communication_exports" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "exported_by" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "date_range_from" TIMESTAMPTZ(6),
    "date_range_to" TIMESTAMPTZ(6),
    "channel_types" JSONB NOT NULL,
    "include_attachments" BOOLEAN NOT NULL DEFAULT false,
    "total_entries" INTEGER NOT NULL,
    "file_url" TEXT,
    "status" "ExportStatus" NOT NULL DEFAULT 'Processing',
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "communication_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable communication_templates
CREATE TABLE IF NOT EXISTS "communication_templates" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "category" "TemplateCategory" NOT NULL,
    "channel_type" "CommunicationChannel" NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "variables" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable bulk_communications
CREATE TABLE IF NOT EXISTS "bulk_communications" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "template_id" TEXT,
    "channel_type" "CommunicationChannel" NOT NULL,
    "subject" VARCHAR(500),
    "body" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "status" "BulkCommunicationStatus" NOT NULL DEFAULT 'Draft',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bulk_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable bulk_communication_logs
CREATE TABLE IF NOT EXISTS "bulk_communication_logs" (
    "id" TEXT NOT NULL,
    "bulk_communication_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "recipient_email" VARCHAR(255) NOT NULL,
    "recipient_name" VARCHAR(200),
    "status" "BulkLogStatus" NOT NULL DEFAULT 'Pending',
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if table was created)
CREATE INDEX IF NOT EXISTS "communication_entries_firm_id_idx" ON "communication_entries"("firm_id");
CREATE INDEX IF NOT EXISTS "communication_entries_case_id_sent_at_idx" ON "communication_entries"("case_id", "sent_at");
CREATE INDEX IF NOT EXISTS "communication_entries_channel_type_idx" ON "communication_entries"("channel_type");
CREATE INDEX IF NOT EXISTS "communication_entries_sender_id_idx" ON "communication_entries"("sender_id");
CREATE INDEX IF NOT EXISTS "communication_entries_external_id_idx" ON "communication_entries"("external_id");
CREATE INDEX IF NOT EXISTS "communication_entries_parent_id_idx" ON "communication_entries"("parent_id");

CREATE INDEX IF NOT EXISTS "communication_attachments_communication_entry_id_idx" ON "communication_attachments"("communication_entry_id");
CREATE INDEX IF NOT EXISTS "communication_attachments_document_id_idx" ON "communication_attachments"("document_id");

CREATE INDEX IF NOT EXISTS "communication_exports_case_id_idx" ON "communication_exports"("case_id");
CREATE INDEX IF NOT EXISTS "communication_exports_exported_by_idx" ON "communication_exports"("exported_by");
CREATE INDEX IF NOT EXISTS "communication_exports_status_idx" ON "communication_exports"("status");

CREATE INDEX IF NOT EXISTS "communication_templates_firm_id_idx" ON "communication_templates"("firm_id");
CREATE INDEX IF NOT EXISTS "communication_templates_category_idx" ON "communication_templates"("category");
CREATE INDEX IF NOT EXISTS "communication_templates_channel_type_idx" ON "communication_templates"("channel_type");

CREATE INDEX IF NOT EXISTS "bulk_communications_firm_id_idx" ON "bulk_communications"("firm_id");
CREATE INDEX IF NOT EXISTS "bulk_communications_case_id_idx" ON "bulk_communications"("case_id");
CREATE INDEX IF NOT EXISTS "bulk_communications_created_by_idx" ON "bulk_communications"("created_by");
CREATE INDEX IF NOT EXISTS "bulk_communications_status_idx" ON "bulk_communications"("status");

CREATE INDEX IF NOT EXISTS "bulk_communication_logs_bulk_communication_id_idx" ON "bulk_communication_logs"("bulk_communication_id");
CREATE INDEX IF NOT EXISTS "bulk_communication_logs_status_idx" ON "bulk_communication_logs"("status");

-- AddForeignKey (only if not exists - using DO block for safety)
DO $$ BEGIN
    ALTER TABLE "communication_entries" ADD CONSTRAINT "communication_entries_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_entries" ADD CONSTRAINT "communication_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_entries" ADD CONSTRAINT "communication_entries_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_attachments" ADD CONSTRAINT "communication_attachments_communication_entry_id_fkey" FOREIGN KEY ("communication_entry_id") REFERENCES "communication_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_attachments" ADD CONSTRAINT "communication_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_exports" ADD CONSTRAINT "communication_exports_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_exports" ADD CONSTRAINT "communication_exports_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_exports" ADD CONSTRAINT "communication_exports_exported_by_fkey" FOREIGN KEY ("exported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bulk_communications" ADD CONSTRAINT "bulk_communications_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bulk_communications" ADD CONSTRAINT "bulk_communications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bulk_communications" ADD CONSTRAINT "bulk_communications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bulk_communications" ADD CONSTRAINT "bulk_communications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "bulk_communication_logs" ADD CONSTRAINT "bulk_communication_logs_bulk_communication_id_fkey" FOREIGN KEY ("bulk_communication_id") REFERENCES "bulk_communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
