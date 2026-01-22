-- Remove document review feature (deprecated, replaced by context documents)

-- Drop foreign keys first
ALTER TABLE "ai_review_concerns" DROP CONSTRAINT IF EXISTS "ai_review_concerns_review_id_fkey";
ALTER TABLE "batch_reviews" DROP CONSTRAINT IF EXISTS "batch_reviews_created_by_fkey";
ALTER TABLE "batch_reviews" DROP CONSTRAINT IF EXISTS "batch_reviews_firm_id_fkey";
ALTER TABLE "document_reviews" DROP CONSTRAINT IF EXISTS "document_reviews_assigned_to_fkey";
ALTER TABLE "document_reviews" DROP CONSTRAINT IF EXISTS "document_reviews_document_id_fkey";
ALTER TABLE "document_reviews" DROP CONSTRAINT IF EXISTS "document_reviews_document_version_id_fkey";
ALTER TABLE "document_reviews" DROP CONSTRAINT IF EXISTS "document_reviews_submitted_by_fkey";
ALTER TABLE "review_comment_replies" DROP CONSTRAINT IF EXISTS "review_comment_replies_author_id_fkey";
ALTER TABLE "review_comment_replies" DROP CONSTRAINT IF EXISTS "review_comment_replies_comment_id_fkey";
ALTER TABLE "review_comments" DROP CONSTRAINT IF EXISTS "review_comments_author_id_fkey";
ALTER TABLE "review_comments" DROP CONSTRAINT IF EXISTS "review_comments_resolved_by_fkey";
ALTER TABLE "review_comments" DROP CONSTRAINT IF EXISTS "review_comments_review_id_fkey";
ALTER TABLE "review_history" DROP CONSTRAINT IF EXISTS "review_history_actor_id_fkey";
ALTER TABLE "review_history" DROP CONSTRAINT IF EXISTS "review_history_review_id_fkey";

-- Drop tables
DROP TABLE IF EXISTS "ai_review_concerns" CASCADE;
DROP TABLE IF EXISTS "review_comment_replies" CASCADE;
DROP TABLE IF EXISTS "review_comments" CASCADE;
DROP TABLE IF EXISTS "review_history" CASCADE;
DROP TABLE IF EXISTS "document_reviews" CASCADE;
DROP TABLE IF EXISTS "batch_reviews" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "BatchReviewStatus" CASCADE;
DROP TYPE IF EXISTS "ConcernSeverity" CASCADE;
DROP TYPE IF EXISTS "ConcernType" CASCADE;
DROP TYPE IF EXISTS "ReviewAction" CASCADE;
DROP TYPE IF EXISTS "ReviewPriority" CASCADE;
DROP TYPE IF EXISTS "ReviewStatus" CASCADE;

-- Update DocumentStatus enum: simplify to DRAFT, READY_FOR_REVIEW, FINAL
-- Note: PostgreSQL doesn't support DROP VALUE from enum, so we recreate with a workaround

-- Step 1: Create new enum type with correct values
CREATE TYPE "DocumentStatus_new" AS ENUM (
    'DRAFT',
    'READY_FOR_REVIEW',
    'FINAL'
);

-- Step 2: Drop the default constraint on the column
ALTER TABLE "documents" ALTER COLUMN "status" DROP DEFAULT;

-- Step 3: Update the column to use text temporarily
ALTER TABLE "documents" ALTER COLUMN "status" TYPE TEXT;

-- Step 4: Update any values that are being removed (map to appropriate new values)
UPDATE "documents" SET "status" = 'DRAFT' WHERE "status" = 'PENDING';
UPDATE "documents" SET "status" = 'DRAFT' WHERE "status" = 'IN_REVIEW';
UPDATE "documents" SET "status" = 'DRAFT' WHERE "status" = 'CHANGES_REQUESTED';
UPDATE "documents" SET "status" = 'FINAL' WHERE "status" = 'ARCHIVED';
UPDATE "documents" SET "status" = 'FINAL' WHERE "status" = 'SIGNED';
UPDATE "documents" SET "status" = 'FINAL' WHERE "status" = 'SENT';
UPDATE "documents" SET "status" = 'FINAL' WHERE "status" = 'FILED';
UPDATE "documents" SET "status" = 'FINAL' WHERE "status" = 'VOID';

-- Step 5: Convert column to new enum type
ALTER TABLE "documents" ALTER COLUMN "status" TYPE "DocumentStatus_new" USING "status"::"DocumentStatus_new";

-- Step 6: Restore the default
ALTER TABLE "documents" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"DocumentStatus_new";

-- Step 7: Drop old enum and rename new one
DROP TYPE IF EXISTS "DocumentStatus";
ALTER TYPE "DocumentStatus_new" RENAME TO "DocumentStatus";

-- Add content_hash column to documents for deduplication
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
