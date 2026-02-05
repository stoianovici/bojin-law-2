-- Migration: Add validation flow fields for document and cluster validation
-- This migration adds support for the new validation workflow:
-- - ValidationStatus enum (Pending, Accepted, Deleted, Reclassified)
-- - Document validation fields (validationStatus, validatedBy, validatedAt, reclassificationNote, reclassificationRound)
-- - Cluster soft delete fields (isDeleted, deletedBy, deletedAt)
-- - ReClustering status for pipeline

-- Add ValidationStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ValidationStatus') THEN
    CREATE TYPE "ValidationStatus" AS ENUM ('Pending', 'Accepted', 'Deleted', 'Reclassified');
  END IF;
END$$;

-- Add ReClustering to CategorizationPipelineStatus enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ReClustering'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'CategorizationPipelineStatus')
  ) THEN
    ALTER TYPE "CategorizationPipelineStatus" ADD VALUE IF NOT EXISTS 'ReClustering' AFTER 'ReadyForValidation';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

-- Add validation fields to extracted_documents
ALTER TABLE "extracted_documents"
ADD COLUMN IF NOT EXISTS "validation_status" "ValidationStatus",
ADD COLUMN IF NOT EXISTS "validated_by" TEXT,
ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "reclassification_note" TEXT,
ADD COLUMN IF NOT EXISTS "reclassification_round" INTEGER NOT NULL DEFAULT 0;

-- Add soft delete fields to document_clusters
ALTER TABLE "document_clusters"
ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deleted_by" TEXT,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "extracted_documents_validation_status_idx" ON "extracted_documents"("validation_status");
CREATE INDEX IF NOT EXISTS "extracted_documents_session_validation_idx" ON "extracted_documents"("session_id", "validation_status");
CREATE INDEX IF NOT EXISTS "document_clusters_session_deleted_idx" ON "document_clusters"("session_id", "is_deleted");
