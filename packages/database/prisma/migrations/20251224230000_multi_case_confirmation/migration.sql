-- OPS-195: Multi-Case Confirmation Flow
-- Add confirmation fields to EmailCaseLink for multi-case sender scenarios

-- Add confirmation fields
ALTER TABLE "email_case_links" ADD COLUMN "needs_confirmation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_case_links" ADD COLUMN "is_confirmed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "email_case_links" ADD COLUMN "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "email_case_links" ADD COLUMN "confirmed_by" TEXT;

-- Create index for quick lookup of unconfirmed emails
CREATE INDEX "email_case_links_needs_confirmation_idx" ON "email_case_links"("needs_confirmation") WHERE "needs_confirmation" = true;
CREATE INDEX "email_case_links_is_confirmed_idx" ON "email_case_links"("is_confirmed") WHERE "is_confirmed" = false;
