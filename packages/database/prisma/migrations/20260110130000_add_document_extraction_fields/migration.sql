-- Add document content extraction fields for AI processing
-- This enables storing extracted text content from documents for search and AI analysis

-- Create the extraction status enum (if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE "DocumentExtractionStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add extraction columns to documents table (if they don't exist)
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extracted_content" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extracted_content_updated_at" TIMESTAMPTZ(6);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_status" "DocumentExtractionStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extraction_error" VARCHAR(500);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "process_with_ai" BOOLEAN NOT NULL DEFAULT false;

-- Add index for efficient querying by extraction status (if it doesn't exist)
CREATE INDEX IF NOT EXISTS "documents_extraction_status_idx" ON "documents"("extraction_status");
