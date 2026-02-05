-- AI-Enhanced Document Categorization Pipeline
-- Migration: 20260204_ai_categorization

-- ============================================================================
-- New Enums
-- ============================================================================

-- AI Triage classification for document origin
CREATE TYPE "TriageStatus" AS ENUM ('FirmDrafted', 'ThirdParty', 'Irrelevant', 'CourtDoc', 'Uncertain');

-- Cluster validation status
CREATE TYPE "ClusterStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- AI Categorization Pipeline processing status
CREATE TYPE "CategorizationPipelineStatus" AS ENUM (
  'NotStarted',
  'Triaging',
  'Deduplicating',
  'Embedding',
  'Clustering',
  'Naming',
  'ReadyForValidation',
  'Extracting',
  'Completed',
  'Failed'
);

-- ============================================================================
-- Add columns to legacy_import_sessions
-- ============================================================================

ALTER TABLE "legacy_import_sessions"
  ADD COLUMN IF NOT EXISTS "pipeline_status" "CategorizationPipelineStatus",
  ADD COLUMN IF NOT EXISTS "pipeline_started_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pipeline_completed_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pipeline_error" TEXT,
  ADD COLUMN IF NOT EXISTS "pipeline_progress" JSONB,
  ADD COLUMN IF NOT EXISTS "triage_stats" JSONB,
  ADD COLUMN IF NOT EXISTS "deduplication_stats" JSONB,
  ADD COLUMN IF NOT EXISTS "clustering_stats" JSONB;

CREATE INDEX IF NOT EXISTS "legacy_import_sessions_pipeline_status_idx"
  ON "legacy_import_sessions"("pipeline_status");

-- ============================================================================
-- Add columns to extracted_documents
-- ============================================================================

-- Triage fields
ALTER TABLE "extracted_documents"
  ADD COLUMN IF NOT EXISTS "triage_status" "TriageStatus",
  ADD COLUMN IF NOT EXISTS "triage_confidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "triage_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "suggested_doc_type" VARCHAR(200);

-- Deduplication fields
ALTER TABLE "extracted_documents"
  ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "duplicate_group_id" UUID,
  ADD COLUMN IF NOT EXISTS "is_canonical" BOOLEAN DEFAULT true;

-- Embedding field (1536 dimensions for Voyage AI)
ALTER TABLE "extracted_documents"
  ADD COLUMN IF NOT EXISTS "content_embedding" vector(1536);

-- Cluster assignment
ALTER TABLE "extracted_documents"
  ADD COLUMN IF NOT EXISTS "cluster_id" UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS "extracted_documents_content_hash_idx"
  ON "extracted_documents"("content_hash");
CREATE INDEX IF NOT EXISTS "extracted_documents_duplicate_group_id_idx"
  ON "extracted_documents"("duplicate_group_id");
CREATE INDEX IF NOT EXISTS "extracted_documents_triage_status_idx"
  ON "extracted_documents"("triage_status");
CREATE INDEX IF NOT EXISTS "extracted_documents_cluster_id_idx"
  ON "extracted_documents"("cluster_id");
CREATE INDEX IF NOT EXISTS "extracted_documents_session_triage_idx"
  ON "extracted_documents"("session_id", "triage_status");
CREATE INDEX IF NOT EXISTS "extracted_documents_session_canonical_idx"
  ON "extracted_documents"("session_id", "is_canonical");

-- ============================================================================
-- Create document_clusters table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "document_clusters" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "suggested_name" VARCHAR(200) NOT NULL,
  "suggested_name_en" VARCHAR(200),
  "description" TEXT,
  "approved_name" VARCHAR(200),
  "status" "ClusterStatus" NOT NULL DEFAULT 'Pending',
  "document_count" INTEGER NOT NULL,
  "sample_document_ids" UUID[] NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "document_clusters_session_id_fkey"
    FOREIGN KEY ("session_id")
    REFERENCES "legacy_import_sessions"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "document_clusters_session_id_idx"
  ON "document_clusters"("session_id");
CREATE INDEX IF NOT EXISTS "document_clusters_session_status_idx"
  ON "document_clusters"("session_id", "status");

-- ============================================================================
-- Create document_templates table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cluster_id" UUID NOT NULL UNIQUE,
  "name" VARCHAR(200) NOT NULL,
  "name_en" VARCHAR(200),
  "description" TEXT,
  "sections" JSONB NOT NULL,
  "variable_fields" JSONB NOT NULL,
  "boilerplate_clauses" JSONB NOT NULL,
  "style_guide" JSONB NOT NULL,
  "source_document_ids" UUID[] NOT NULL DEFAULT '{}',
  "extraction_confidence" DOUBLE PRECISION NOT NULL,
  "language" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "document_templates_cluster_id_fkey"
    FOREIGN KEY ("cluster_id")
    REFERENCES "document_clusters"("id")
    ON DELETE CASCADE
);

-- ============================================================================
-- Add foreign key for cluster_id on extracted_documents
-- ============================================================================

ALTER TABLE "extracted_documents"
  ADD CONSTRAINT "extracted_documents_cluster_id_fkey"
    FOREIGN KEY ("cluster_id")
    REFERENCES "document_clusters"("id")
    ON DELETE SET NULL;
