-- OPS-113: Rule-Based Document Filtering
-- Add filter tracking fields to email_attachments table

-- Add filter status tracking fields
ALTER TABLE "email_attachments" ADD COLUMN "filter_status" VARCHAR(20);
ALTER TABLE "email_attachments" ADD COLUMN "filter_rule_id" VARCHAR(50);
ALTER TABLE "email_attachments" ADD COLUMN "filter_reason" VARCHAR(200);
ALTER TABLE "email_attachments" ADD COLUMN "dismissed_at" TIMESTAMPTZ;

-- Add index for filtering by status
CREATE INDEX "email_attachments_filter_status_idx" ON "email_attachments"("filter_status");
