-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "cache_creation_tokens" INTEGER,
ADD COLUMN     "cache_read_tokens" INTEGER,
ADD COLUMN     "thinking_tokens" INTEGER;

-- CreateTable
CREATE TABLE "case_context_files" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "context_critical" TEXT,
    "context_standard" TEXT,
    "compressed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_context_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_context_files_case_id_idx" ON "case_context_files"("case_id");

-- CreateIndex
CREATE INDEX "case_context_files_firm_id_idx" ON "case_context_files"("firm_id");

-- CreateIndex
CREATE INDEX "case_context_files_valid_until_idx" ON "case_context_files"("valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "case_context_files_case_id_source_key" ON "case_context_files"("case_id", "source");

-- AddForeignKey
ALTER TABLE "case_context_files" ADD CONSTRAINT "case_context_files_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_context_files" ADD CONSTRAINT "case_context_files_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
