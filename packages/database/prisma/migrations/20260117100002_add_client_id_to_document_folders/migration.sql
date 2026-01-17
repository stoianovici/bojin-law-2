-- AlterTable - Add client_id to document_folders and make case_id nullable
ALTER TABLE "document_folders" ADD COLUMN "client_id" TEXT;
ALTER TABLE "document_folders" ALTER COLUMN "case_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "document_folders_client_id_idx" ON "document_folders"("client_id");

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
