-- AlterTable: Add cleaned email body content (OPS-090)
ALTER TABLE "Email" ADD COLUMN "body_content_clean" TEXT;
