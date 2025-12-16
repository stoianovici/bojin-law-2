-- OPS-027: Classification Schema & Data Model
-- Add email classification fields for multi-case email segregation

-- CreateEnum
CREATE TYPE "GlobalEmailSourceCategory" AS ENUM ('Court', 'Notary', 'Bailiff', 'Authority', 'Other');

-- CreateTable
CREATE TABLE "global_email_sources" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "category" "GlobalEmailSourceCategory" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "classification_hint" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "global_email_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "global_email_sources_firm_id_idx" ON "global_email_sources"("firm_id");

-- CreateIndex
CREATE INDEX "global_email_sources_category_idx" ON "global_email_sources"("category");

-- AddForeignKey
ALTER TABLE "global_email_sources" ADD CONSTRAINT "global_email_sources_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add classification fields to cases
ALTER TABLE "cases" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cases" ADD COLUMN "reference_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cases" ADD COLUMN "subject_patterns" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cases" ADD COLUMN "classification_notes" TEXT;

-- AlterTable: Add emailDomains to case_actors
ALTER TABLE "case_actors" ADD COLUMN "email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[];
