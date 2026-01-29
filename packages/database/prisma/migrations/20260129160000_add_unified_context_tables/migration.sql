-- Add Unified Context Tables
-- Creates context_files, context_references, and user_corrections tables
-- These tables support the unified context system for clients and cases

-- ============================================================================
-- ENUMS
-- ============================================================================

-- CreateEnum: ContextEntityType (if not exists)
DO $$ BEGIN
    CREATE TYPE "ContextEntityType" AS ENUM ('CLIENT', 'CASE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ContextRefType (if not exists)
DO $$ BEGIN
    CREATE TYPE "ContextRefType" AS ENUM ('DOCUMENT', 'EMAIL', 'THREAD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: CorrectionType (if not exists)
DO $$ BEGIN
    CREATE TYPE "CorrectionType" AS ENUM ('OVERRIDE', 'APPEND', 'REMOVE', 'NOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- CreateTable: context_files
CREATE TABLE IF NOT EXISTS "context_files" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "entity_type" "ContextEntityType" NOT NULL,
    "client_id" TEXT,
    "case_id" TEXT,
    "identity" JSONB NOT NULL,
    "people" JSONB NOT NULL,
    "documents" JSONB NOT NULL,
    "communications" JSONB NOT NULL,
    "last_corrected_by" TEXT,
    "corrections_applied_at" TIMESTAMPTZ(6),
    "content_critical" TEXT NOT NULL,
    "content_standard" TEXT NOT NULL,
    "content_full" TEXT NOT NULL,
    "tokens_critical" INTEGER NOT NULL,
    "tokens_standard" INTEGER NOT NULL,
    "tokens_full" INTEGER NOT NULL,
    "parent_context_snapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "context_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable: context_references
CREATE TABLE IF NOT EXISTS "context_references" (
    "id" TEXT NOT NULL,
    "context_file_id" TEXT NOT NULL,
    "ref_id" VARCHAR(20) NOT NULL,
    "ref_type" "ContextRefType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "summary" TEXT,
    "source_date" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_corrections
CREATE TABLE IF NOT EXISTS "user_corrections" (
    "id" TEXT NOT NULL,
    "context_file_id" TEXT NOT NULL,
    "section_id" VARCHAR(100) NOT NULL,
    "field_path" VARCHAR(200),
    "correction_type" "CorrectionType" NOT NULL,
    "original_value" TEXT,
    "corrected_value" TEXT NOT NULL,
    "reason" TEXT,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_corrections_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for context_files
CREATE UNIQUE INDEX IF NOT EXISTS "context_files_client_id_key" ON "context_files"("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "context_files_case_id_key" ON "context_files"("case_id");
CREATE INDEX IF NOT EXISTS "context_files_firm_id_idx" ON "context_files"("firm_id");
CREATE INDEX IF NOT EXISTS "context_files_entity_type_idx" ON "context_files"("entity_type");
CREATE INDEX IF NOT EXISTS "context_files_valid_until_idx" ON "context_files"("valid_until");
CREATE INDEX IF NOT EXISTS "context_files_firm_id_valid_until_idx" ON "context_files"("firm_id", "valid_until");

-- Indexes for context_references
CREATE UNIQUE INDEX IF NOT EXISTS "context_references_context_file_id_ref_id_key" ON "context_references"("context_file_id", "ref_id");
CREATE INDEX IF NOT EXISTS "context_references_context_file_id_idx" ON "context_references"("context_file_id");
CREATE INDEX IF NOT EXISTS "context_references_source_id_idx" ON "context_references"("source_id");
CREATE INDEX IF NOT EXISTS "context_references_ref_id_idx" ON "context_references"("ref_id");

-- Indexes for user_corrections
CREATE INDEX IF NOT EXISTS "user_corrections_context_file_id_idx" ON "user_corrections"("context_file_id");
CREATE INDEX IF NOT EXISTS "user_corrections_created_by_idx" ON "user_corrections"("created_by");
CREATE INDEX IF NOT EXISTS "user_corrections_is_active_idx" ON "user_corrections"("is_active");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

-- Foreign keys for context_files
ALTER TABLE "context_files" DROP CONSTRAINT IF EXISTS "context_files_client_id_fkey";
ALTER TABLE "context_files" ADD CONSTRAINT "context_files_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "context_files" DROP CONSTRAINT IF EXISTS "context_files_case_id_fkey";
ALTER TABLE "context_files" ADD CONSTRAINT "context_files_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "context_files" DROP CONSTRAINT IF EXISTS "context_files_firm_id_fkey";
ALTER TABLE "context_files" ADD CONSTRAINT "context_files_firm_id_fkey"
    FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for context_references
ALTER TABLE "context_references" DROP CONSTRAINT IF EXISTS "context_references_context_file_id_fkey";
ALTER TABLE "context_references" ADD CONSTRAINT "context_references_context_file_id_fkey"
    FOREIGN KEY ("context_file_id") REFERENCES "context_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for user_corrections
ALTER TABLE "user_corrections" DROP CONSTRAINT IF EXISTS "user_corrections_context_file_id_fkey";
ALTER TABLE "user_corrections" ADD CONSTRAINT "user_corrections_context_file_id_fkey"
    FOREIGN KEY ("context_file_id") REFERENCES "context_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
