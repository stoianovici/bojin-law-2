-- ============================================================================
-- Final Schema Sync: Align database with Prisma schema
-- ============================================================================

-- ============================================================================
-- 1. Add missing enum value
-- ============================================================================
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'Deleted';

-- ============================================================================
-- 2. Cleanup CaseSyncStatus enum (remove unused Synced, Error values)
-- ============================================================================
-- Note: No data uses these values, safe to remove
BEGIN;
CREATE TYPE "CaseSyncStatus_new" AS ENUM ('Pending', 'Syncing', 'Completed', 'Failed');
ALTER TABLE "cases" ALTER COLUMN "sync_status" DROP DEFAULT;
ALTER TABLE "cases" ALTER COLUMN "sync_status" TYPE "CaseSyncStatus_new" USING ("sync_status"::text::"CaseSyncStatus_new");
ALTER TYPE "CaseSyncStatus" RENAME TO "CaseSyncStatus_old";
ALTER TYPE "CaseSyncStatus_new" RENAME TO "CaseSyncStatus";
DROP TYPE "CaseSyncStatus_old";
ALTER TABLE "cases" ALTER COLUMN "sync_status" SET DEFAULT 'Pending';
COMMIT;

-- ============================================================================
-- 3. Cleanup ExportFormat enum
-- ============================================================================
BEGIN;
CREATE TYPE "ExportFormat_new" AS ENUM ('PDF', 'CSV', 'JSON', 'DOCX');
ALTER TABLE "communication_exports" ALTER COLUMN "format" TYPE "ExportFormat_new" USING ("format"::text::"ExportFormat_new");
ALTER TYPE "ExportFormat" RENAME TO "ExportFormat_old";
ALTER TYPE "ExportFormat_new" RENAME TO "ExportFormat";
DROP TYPE "ExportFormat_old";
COMMIT;

-- ============================================================================
-- 4. Cleanup PrivacyLevel enum
-- ============================================================================
BEGIN;
CREATE TYPE "PrivacyLevel_new" AS ENUM ('Normal', 'Confidential', 'AttorneyOnly', 'PartnerOnly');
ALTER TABLE "communication_entries" ALTER COLUMN "privacy_level" DROP DEFAULT;
ALTER TABLE "communication_entries" ALTER COLUMN "privacy_level" TYPE "PrivacyLevel_new" USING ("privacy_level"::text::"PrivacyLevel_new");
ALTER TYPE "PrivacyLevel" RENAME TO "PrivacyLevel_old";
ALTER TYPE "PrivacyLevel_new" RENAME TO "PrivacyLevel";
DROP TYPE "PrivacyLevel_old";
ALTER TABLE "communication_entries" ALTER COLUMN "privacy_level" SET DEFAULT 'Normal';
COMMIT;

-- ============================================================================
-- 5. Cleanup TemplateCategory enum
-- ============================================================================
BEGIN;
CREATE TYPE "TemplateCategory_new" AS ENUM ('ClientUpdate', 'CourtFiling', 'AppointmentReminder', 'DocumentRequest', 'InvoiceReminder', 'CaseOpening', 'CaseClosing', 'General');
ALTER TABLE "communication_templates" ALTER COLUMN "category" TYPE "TemplateCategory_new" USING ("category"::text::"TemplateCategory_new");
ALTER TYPE "TemplateCategory" RENAME TO "TemplateCategory_old";
ALTER TYPE "TemplateCategory_new" RENAME TO "TemplateCategory";
DROP TYPE "TemplateCategory_old";
COMMIT;

-- ============================================================================
-- 6. Fix personal_threads id type (uuid -> text) and recreate FKs
-- ============================================================================
ALTER TABLE "personal_threads" DROP CONSTRAINT IF EXISTS "personal_threads_firm_id_fkey";
ALTER TABLE "personal_threads" DROP CONSTRAINT IF EXISTS "personal_threads_user_id_fkey";
ALTER TABLE "personal_threads" DROP CONSTRAINT IF EXISTS "personal_threads_pkey";
ALTER TABLE "personal_threads" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "personal_threads" ALTER COLUMN "id" SET DATA TYPE TEXT;
ALTER TABLE "personal_threads" ADD CONSTRAINT "personal_threads_pkey" PRIMARY KEY ("id");
ALTER TABLE "personal_threads" ADD CONSTRAINT "personal_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personal_threads" ADD CONSTRAINT "personal_threads_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 7. Drop defaults from AI tables (schema doesn't specify defaults)
-- ============================================================================
ALTER TABLE "ai_conversations" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ai_messages" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ai_feature_configs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- 8. Set NOT NULL on columns that should be required
-- ============================================================================
ALTER TABLE "bulk_communication_logs" ALTER COLUMN "recipient_id" SET NOT NULL;
ALTER TABLE "bulk_communication_logs" ALTER COLUMN "recipient_name" SET NOT NULL;
ALTER TABLE "bulk_communications" ALTER COLUMN "subject" SET NOT NULL;
ALTER TABLE "bulk_communications" ALTER COLUMN "recipient_filter" SET NOT NULL;
ALTER TABLE "bulk_communications" ALTER COLUMN "recipients" SET NOT NULL;
ALTER TABLE "bulk_communications" ALTER COLUMN "total_recipients" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "administrators" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "contacts" SET NOT NULL;
ALTER TABLE "communication_attachments" ALTER COLUMN "storage_url" SET NOT NULL;

-- ============================================================================
-- 9. Drop unused columns from bulk_communications
-- ============================================================================
ALTER TABLE "bulk_communications" DROP COLUMN IF EXISTS "failure_count";
ALTER TABLE "bulk_communications" DROP COLUMN IF EXISTS "recipient_count";
ALTER TABLE "bulk_communications" DROP COLUMN IF EXISTS "scheduled_at";
ALTER TABLE "bulk_communications" DROP COLUMN IF EXISTS "success_count";

-- ============================================================================
-- 10. Fix bulk_communications.recipient_type column type
-- ============================================================================
-- Table is empty, so we can safely drop and recreate the column as proper enum
ALTER TABLE "bulk_communications" DROP COLUMN IF EXISTS "recipient_type";
ALTER TABLE "bulk_communications" ADD COLUMN "recipient_type" "BulkRecipientType" NOT NULL;

-- ============================================================================
-- 11. Update users default role
-- ============================================================================
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'AssociateJr';
