-- AlterTable: Add cleaned email body content (OPS-090)
ALTER TABLE "emails" ADD COLUMN "body_content_clean" TEXT;
