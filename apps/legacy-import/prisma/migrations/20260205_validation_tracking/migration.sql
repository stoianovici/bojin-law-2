-- Add validation tracking fields to document_clusters table
ALTER TABLE "document_clusters"
ADD COLUMN IF NOT EXISTS "validated_by" TEXT,
ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMPTZ;

-- Add cluster validation tracking field to extracted_documents table
ALTER TABLE "extracted_documents"
ADD COLUMN IF NOT EXISTS "cluster_validated_by" TEXT;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS "document_clusters_validated_by_idx" ON "document_clusters"("validated_by");
