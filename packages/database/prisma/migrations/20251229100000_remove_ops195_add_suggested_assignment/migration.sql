-- Remove OPS-195 confirmation fields from email_case_links
ALTER TABLE "email_case_links" DROP COLUMN IF EXISTS "needs_confirmation";
ALTER TABLE "email_case_links" DROP COLUMN IF EXISTS "is_confirmed";
ALTER TABLE "email_case_links" DROP COLUMN IF EXISTS "confirmed_at";
ALTER TABLE "email_case_links" DROP COLUMN IF EXISTS "confirmed_by";

-- Add isSuggestedAssignment to emails
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "is_suggested_assignment" BOOLEAN NOT NULL DEFAULT false;
