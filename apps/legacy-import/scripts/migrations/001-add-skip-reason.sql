-- Migration: Add skip_reason and duplicate_of columns to extracted_documents
-- Purpose: Support filtering scanned vs email documents in categorization UI
-- Run via: psql or through SSH tunnel
--
-- Usage (via SSH tunnel):
--   ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197
--   psql -h localhost -p 5433 -U legal_platform -d legal_platform -f scripts/migrations/001-add-skip-reason.sql

-- Add skip_reason column
-- Values: 'Scanned' for image-only PDFs, 'Duplicate' for duplicate documents, NULL for regular email docs
ALTER TABLE extracted_documents
ADD COLUMN IF NOT EXISTS skip_reason VARCHAR(50);

-- Add duplicate_of column to track which document a duplicate refers to
ALTER TABLE extracted_documents
ADD COLUMN IF NOT EXISTS duplicate_of UUID;

-- Create index for efficient filtering by skip_reason
CREATE INDEX IF NOT EXISTS idx_extracted_documents_skip_reason
ON extracted_documents(skip_reason);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'extracted_documents'
AND column_name IN ('skip_reason', 'duplicate_of');

-- Show count of documents by skip_reason (should all be NULL initially)
SELECT skip_reason, COUNT(*) as count
FROM extracted_documents
GROUP BY skip_reason;
