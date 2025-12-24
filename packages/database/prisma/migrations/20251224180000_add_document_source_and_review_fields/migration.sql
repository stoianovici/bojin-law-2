-- OPS-171: Document Source Type & Review Fields
-- This migration adds:
-- 1. DocumentSourceType enum to distinguish document origins
-- 2. Review fields on Document (sourceType, reviewerId, submittedAt)
-- 3. Promotion tracking on CaseDocument (promotedFromAttachment, originalAttachmentId)

-- Create the DocumentSourceType enum
CREATE TYPE "DocumentSourceType" AS ENUM ('UPLOAD', 'EMAIL_ATTACHMENT', 'AI_GENERATED', 'TEMPLATE');

-- Add sourceType, reviewerId, and submittedAt to documents table
ALTER TABLE "documents" ADD COLUMN "source_type" "DocumentSourceType" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "documents" ADD COLUMN "reviewer_id" TEXT;
ALTER TABLE "documents" ADD COLUMN "submitted_at" TIMESTAMPTZ;

-- Add foreign key constraint for reviewer
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for new fields
CREATE INDEX "documents_source_type_idx" ON "documents"("source_type");
CREATE INDEX "documents_reviewer_id_idx" ON "documents"("reviewer_id");

-- Add promotion tracking fields to case_documents table
ALTER TABLE "case_documents" ADD COLUMN "promoted_from_attachment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "case_documents" ADD COLUMN "original_attachment_id" TEXT;

-- Add foreign key constraint for original attachment
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_original_attachment_id_fkey" FOREIGN KEY ("original_attachment_id") REFERENCES "email_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for promotion tracking
CREATE INDEX "case_documents_promoted_from_attachment_idx" ON "case_documents"("promoted_from_attachment");

-- Backfill: Set sourceType = EMAIL_ATTACHMENT for documents that came from email attachments
UPDATE "documents"
SET "source_type" = 'EMAIL_ATTACHMENT'
WHERE id IN (
  SELECT document_id FROM "email_attachments" WHERE document_id IS NOT NULL
);
