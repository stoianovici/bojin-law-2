-- Add isIgnored and ignoredAt fields to emails table
ALTER TABLE "emails" ADD COLUMN "is_ignored" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "emails" ADD COLUMN "ignored_at" TIMESTAMPTZ;

-- Create index for filtering ignored emails
CREATE INDEX "emails_is_ignored_idx" ON "emails"("is_ignored");
