-- OPS-035: Data Model - Classification State & Case Metadata
-- Add email classification state machine fields

-- CreateEnum: Email classification state machine
CREATE TYPE "EmailClassificationState" AS ENUM ('Pending', 'Classified', 'Uncertain', 'CourtUnassigned', 'Ignored');

-- AlterTable: Add classification state fields to emails
ALTER TABLE "emails" ADD COLUMN "classification_state" "EmailClassificationState" NOT NULL DEFAULT 'Pending';
ALTER TABLE "emails" ADD COLUMN "classification_confidence" DOUBLE PRECISION;
ALTER TABLE "emails" ADD COLUMN "classified_at" TIMESTAMPTZ;
ALTER TABLE "emails" ADD COLUMN "classified_by" TEXT;

-- CreateIndex: Index for filtering by classification state
CREATE INDEX "emails_classification_state_idx" ON "emails"("classification_state");

-- Backfill: Set existing emails with caseId to CLASSIFIED state
UPDATE "emails"
SET
  "classification_state" = 'Classified',
  "classified_at" = CURRENT_TIMESTAMP,
  "classified_by" = 'migration'
WHERE "case_id" IS NOT NULL;

-- Backfill: Set existing ignored emails to IGNORED state
UPDATE "emails"
SET "classification_state" = 'Ignored'
WHERE "is_ignored" = true;
