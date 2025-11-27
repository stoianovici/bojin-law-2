-- CreateEnum
CREATE TYPE "DocumentAuditAction" AS ENUM ('Uploaded', 'LinkedToCase', 'UnlinkedFromCase', 'PermanentlyDeleted', 'MetadataUpdated');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_documents" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "linked_by" TEXT NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_original" BOOLEAN NOT NULL DEFAULT false,
    "firm_id" TEXT NOT NULL,

    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audit_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "user_id" TEXT NOT NULL,
    "action" "DocumentAuditAction" NOT NULL,
    "case_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firm_id" TEXT NOT NULL,

    CONSTRAINT "document_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_firm_id_idx" ON "documents"("firm_id");

-- CreateIndex
CREATE INDEX "documents_uploaded_at_idx" ON "documents"("uploaded_at");

-- CreateIndex
CREATE INDEX "documents_file_name_idx" ON "documents"("file_name");

-- CreateIndex
CREATE INDEX "case_documents_case_id_idx" ON "case_documents"("case_id");

-- CreateIndex
CREATE INDEX "case_documents_document_id_idx" ON "case_documents"("document_id");

-- CreateIndex
CREATE INDEX "case_documents_firm_id_idx" ON "case_documents"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_documents_case_id_document_id_key" ON "case_documents"("case_id", "document_id");

-- CreateIndex
CREATE INDEX "document_audit_logs_document_id_idx" ON "document_audit_logs"("document_id");

-- CreateIndex
CREATE INDEX "document_audit_logs_user_id_idx" ON "document_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "document_audit_logs_case_id_idx" ON "document_audit_logs"("case_id");

-- CreateIndex
CREATE INDEX "document_audit_logs_timestamp_idx" ON "document_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "document_audit_logs_firm_id_idx" ON "document_audit_logs"("firm_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_documents" ADD CONSTRAINT "case_documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_logs" ADD CONSTRAINT "document_audit_logs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
