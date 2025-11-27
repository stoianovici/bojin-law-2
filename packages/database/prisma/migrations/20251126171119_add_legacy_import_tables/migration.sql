-- CreateEnum
CREATE TYPE "ImportSessionStatus" AS ENUM ('Uploading', 'Extracting', 'InProgress', 'Completed', 'Exported');

-- CreateEnum
CREATE TYPE "PrimaryLanguage" AS ENUM ('Romanian', 'English', 'Italian', 'French', 'Mixed');

-- CreateEnum
CREATE TYPE "TemplatePotential" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('structured', 'semi-structured', 'unstructured');

-- CreateEnum
CREATE TYPE "DocumentCategorizationStatus" AS ENUM ('Uncategorized', 'Categorized', 'Skipped');

-- DropIndex
DROP INDEX "ai_response_cache_prompt_embedding_idx";

-- CreateTable
CREATE TABLE "legacy_import_sessions" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "pst_file_name" VARCHAR(500) NOT NULL,
    "pst_file_size" BIGINT NOT NULL,
    "pst_storage_path" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "status" "ImportSessionStatus" NOT NULL DEFAULT 'Uploading',
    "total_documents" INTEGER NOT NULL DEFAULT 0,
    "categorized_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "analyzed_count" INTEGER NOT NULL DEFAULT 0,
    "extraction_errors" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "exported_at" TIMESTAMPTZ,
    "cleaned_up_at" TIMESTAMPTZ,

    CONSTRAINT "legacy_import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_batches" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "month_year" VARCHAR(7) NOT NULL,
    "assigned_to" TEXT,
    "document_count" INTEGER NOT NULL,
    "categorized_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_documents" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "file_name" VARCHAR(500) NOT NULL,
    "file_extension" VARCHAR(10) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "folder_path" TEXT NOT NULL,
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "extracted_text" TEXT,
    "email_subject" VARCHAR(1000),
    "email_sender" VARCHAR(500),
    "email_receiver" VARCHAR(500),
    "email_date" TIMESTAMPTZ,
    "category_id" TEXT,
    "status" "DocumentCategorizationStatus" NOT NULL DEFAULT 'Uncategorized',
    "categorized_by" TEXT,
    "categorized_at" TIMESTAMPTZ,
    "primary_language" "PrimaryLanguage",
    "secondary_language" "PrimaryLanguage",
    "language_ratio" JSONB,
    "language_confidence" DOUBLE PRECISION,
    "document_type" VARCHAR(200),
    "document_type_confidence" DOUBLE PRECISION,
    "clause_categories" TEXT[],
    "template_potential" "TemplatePotential",
    "ai_metadata" JSONB,
    "risk_indicators" JSONB,
    "ai_analysis_version" VARCHAR(100),
    "analysis_timestamp" TIMESTAMPTZ,
    "analysis_tokens_used" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "extracted_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_categories" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "merged_into" TEXT,

    CONSTRAINT "import_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_processing_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "document_id" TEXT,
    "model" VARCHAR(100) NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "processing_time_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_audit_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_import_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legacy_import_sessions_firm_id_idx" ON "legacy_import_sessions"("firm_id");

-- CreateIndex
CREATE INDEX "legacy_import_sessions_uploaded_by_idx" ON "legacy_import_sessions"("uploaded_by");

-- CreateIndex
CREATE INDEX "legacy_import_sessions_status_idx" ON "legacy_import_sessions"("status");

-- CreateIndex
CREATE INDEX "legacy_import_sessions_created_at_idx" ON "legacy_import_sessions"("created_at");

-- CreateIndex
CREATE INDEX "document_batches_session_id_idx" ON "document_batches"("session_id");

-- CreateIndex
CREATE INDEX "document_batches_assigned_to_idx" ON "document_batches"("assigned_to");

-- CreateIndex
CREATE INDEX "document_batches_month_year_idx" ON "document_batches"("month_year");

-- CreateIndex
CREATE UNIQUE INDEX "document_batches_session_id_month_year_key" ON "document_batches"("session_id", "month_year");

-- CreateIndex
CREATE INDEX "extracted_documents_session_id_idx" ON "extracted_documents"("session_id");

-- CreateIndex
CREATE INDEX "extracted_documents_batch_id_idx" ON "extracted_documents"("batch_id");

-- CreateIndex
CREATE INDEX "extracted_documents_category_id_idx" ON "extracted_documents"("category_id");

-- CreateIndex
CREATE INDEX "extracted_documents_status_idx" ON "extracted_documents"("status");

-- CreateIndex
CREATE INDEX "extracted_documents_email_date_idx" ON "extracted_documents"("email_date");

-- CreateIndex
CREATE INDEX "extracted_documents_primary_language_idx" ON "extracted_documents"("primary_language");

-- CreateIndex
CREATE INDEX "extracted_documents_template_potential_idx" ON "extracted_documents"("template_potential");

-- CreateIndex
CREATE INDEX "import_categories_session_id_idx" ON "import_categories"("session_id");

-- CreateIndex
CREATE INDEX "import_categories_created_by_idx" ON "import_categories"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "import_categories_session_id_name_key" ON "import_categories"("session_id", "name");

-- CreateIndex
CREATE INDEX "ai_processing_logs_session_id_idx" ON "ai_processing_logs"("session_id");

-- CreateIndex
CREATE INDEX "ai_processing_logs_created_at_idx" ON "ai_processing_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_processing_logs_model_idx" ON "ai_processing_logs"("model");

-- CreateIndex
CREATE INDEX "legacy_import_audit_logs_session_id_idx" ON "legacy_import_audit_logs"("session_id");

-- CreateIndex
CREATE INDEX "legacy_import_audit_logs_user_id_idx" ON "legacy_import_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "legacy_import_audit_logs_action_idx" ON "legacy_import_audit_logs"("action");

-- CreateIndex
CREATE INDEX "legacy_import_audit_logs_timestamp_idx" ON "legacy_import_audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "document_batches" ADD CONSTRAINT "document_batches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "legacy_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_documents" ADD CONSTRAINT "extracted_documents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "legacy_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_documents" ADD CONSTRAINT "extracted_documents_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "document_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_documents" ADD CONSTRAINT "extracted_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "import_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_categories" ADD CONSTRAINT "import_categories_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "legacy_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_processing_logs" ADD CONSTRAINT "ai_processing_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "legacy_import_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
