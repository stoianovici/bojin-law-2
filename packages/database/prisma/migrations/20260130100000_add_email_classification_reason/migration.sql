-- AlterTable
ALTER TABLE "emails" ADD COLUMN "classification_reason" TEXT;
ALTER TABLE "emails" ADD COLUMN "ai_classification_cost" DOUBLE PRECISION;
