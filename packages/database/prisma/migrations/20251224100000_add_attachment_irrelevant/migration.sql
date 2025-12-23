-- OPS-136: Mark Attachment as Irrelevant
-- Add irrelevant flag to email_attachments for user-marked non-useful attachments (signatures, logos, etc.)

-- AlterTable
ALTER TABLE "email_attachments" ADD COLUMN "irrelevant" BOOLEAN NOT NULL DEFAULT false;
