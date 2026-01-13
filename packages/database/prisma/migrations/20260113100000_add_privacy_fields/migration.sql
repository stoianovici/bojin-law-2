-- Add privacy fields for documents, emails, and email_attachments
-- These columns were added to schema in commit a0c09ec but migration was missing

-- Documents: add privacy tracking columns
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "marked_public_at" TIMESTAMPTZ(6);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "marked_public_by" TEXT;

-- Emails: add marked_public tracking (is_private already exists)
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "marked_public_at" TIMESTAMPTZ(6);
ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "marked_public_by" TEXT;

-- Email attachments: add privacy tracking columns
ALTER TABLE "email_attachments" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "email_attachments" ADD COLUMN IF NOT EXISTS "marked_public_at" TIMESTAMPTZ(6);
ALTER TABLE "email_attachments" ADD COLUMN IF NOT EXISTS "marked_public_by" TEXT;
