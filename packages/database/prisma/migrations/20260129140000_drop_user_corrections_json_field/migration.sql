-- Drop user_corrections JSON column from context_files table
-- Migration complete: All corrections are now stored in user_corrections table

ALTER TABLE "context_files" DROP COLUMN IF EXISTS "user_corrections";
