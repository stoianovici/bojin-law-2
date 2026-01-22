-- Add user description fields to documents (for scans)
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "user_description" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "user_description_by" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "user_description_at" TIMESTAMP(6) WITH TIME ZONE;

-- Add foreign key for document description user
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_user_description_by_fkey";
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_description_by_fkey"
  FOREIGN KEY ("user_description_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add communication context fields to case actors
ALTER TABLE "case_actors" ADD COLUMN IF NOT EXISTS "communication_notes" TEXT;
ALTER TABLE "case_actors" ADD COLUMN IF NOT EXISTS "preferred_tone" VARCHAR(50);

-- Create ClientContextDocument table
CREATE TABLE IF NOT EXISTS "client_context_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "context_full" TEXT NOT NULL,
    "context_standard" TEXT,
    "context_critical" TEXT,
    "token_count_full" INTEGER NOT NULL,
    "token_count_standard" INTEGER,
    "token_count_critical" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "valid_until" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "client_context_documents_pkey" PRIMARY KEY ("id")
);

-- Create CaseContextDocument table
CREATE TABLE IF NOT EXISTS "case_context_documents" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "context_full" TEXT NOT NULL,
    "context_standard" TEXT,
    "context_critical" TEXT,
    "token_count_full" INTEGER NOT NULL,
    "token_count_standard" INTEGER,
    "token_count_critical" INTEGER,
    "client_context_snapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "valid_until" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    CONSTRAINT "case_context_documents_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "client_context_documents_client_id_key" ON "client_context_documents"("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "case_context_documents_case_id_key" ON "case_context_documents"("case_id");

-- Add indexes
CREATE INDEX IF NOT EXISTS "client_context_documents_firm_id_idx" ON "client_context_documents"("firm_id");
CREATE INDEX IF NOT EXISTS "client_context_documents_valid_until_idx" ON "client_context_documents"("valid_until");
CREATE INDEX IF NOT EXISTS "case_context_documents_firm_id_idx" ON "case_context_documents"("firm_id");
CREATE INDEX IF NOT EXISTS "case_context_documents_valid_until_idx" ON "case_context_documents"("valid_until");

-- Add foreign keys
ALTER TABLE "client_context_documents" DROP CONSTRAINT IF EXISTS "client_context_documents_client_id_fkey";
ALTER TABLE "client_context_documents" ADD CONSTRAINT "client_context_documents_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_context_documents" DROP CONSTRAINT IF EXISTS "client_context_documents_firm_id_fkey";
ALTER TABLE "client_context_documents" ADD CONSTRAINT "client_context_documents_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_context_documents" DROP CONSTRAINT IF EXISTS "case_context_documents_case_id_fkey";
ALTER TABLE "case_context_documents" ADD CONSTRAINT "case_context_documents_case_id_fkey"
  FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "case_context_documents" DROP CONSTRAINT IF EXISTS "case_context_documents_firm_id_fkey";
ALTER TABLE "case_context_documents" ADD CONSTRAINT "case_context_documents_firm_id_fkey"
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
