-- OPS-058: Multi-Case Email Support
-- Add EmailCaseLink junction table for many-to-many email-to-case relationships

-- Create ClassificationMatchType enum
CREATE TYPE "ClassificationMatchType" AS ENUM (
    'Actor',
    'ReferenceNumber',
    'Keyword',
    'Semantic',
    'GlobalSource',
    'Manual',
    'ThreadContinuity'
);

-- Create the email_case_links junction table
CREATE TABLE "email_case_links" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION DEFAULT 1.0,
    "match_type" "ClassificationMatchType",
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_case_links_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint to prevent duplicate email-case pairs
CREATE UNIQUE INDEX "email_case_links_email_id_case_id_key" ON "email_case_links"("email_id", "case_id");

-- Create indexes for efficient queries
CREATE INDEX "email_case_links_email_id_idx" ON "email_case_links"("email_id");
CREATE INDEX "email_case_links_case_id_idx" ON "email_case_links"("case_id");
CREATE INDEX "email_case_links_linked_at_idx" ON "email_case_links"("linked_at");

-- Add foreign key constraints
ALTER TABLE "email_case_links" ADD CONSTRAINT "email_case_links_email_id_fkey"
    FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_case_links" ADD CONSTRAINT "email_case_links_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OPS-061: Migrate existing email-case relationships to EmailCaseLink table
-- This preserves all existing classifications while enabling multi-case support
INSERT INTO email_case_links (id, email_id, case_id, confidence, match_type, linked_at, linked_by, is_primary)
SELECT
    gen_random_uuid()::text,
    id,
    case_id,
    COALESCE(classification_confidence, 1.0),
    -- Map classified_by to match_type enum values matching Prisma schema
    CASE
        WHEN classified_by ILIKE '%thread%' THEN 'ThreadContinuity'::"ClassificationMatchType"
        WHEN classified_by IN ('auto', 'contact_match', 'migration') THEN 'Actor'::"ClassificationMatchType"
        WHEN classified_by ILIKE '%manual%' THEN 'Manual'::"ClassificationMatchType"
        ELSE 'Actor'::"ClassificationMatchType"
    END,
    COALESCE(classified_at, synced_at),
    COALESCE(classified_by, 'migration'),
    true  -- All existing classifications are primary
FROM emails
WHERE case_id IS NOT NULL;
