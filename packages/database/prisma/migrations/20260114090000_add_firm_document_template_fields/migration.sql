-- AddFirmDocumentTemplateFields
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "document_template_url" VARCHAR(1000);
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "document_template_drive_item_id" VARCHAR(255);
ALTER TABLE "firms" ADD COLUMN IF NOT EXISTS "document_template_file_name" VARCHAR(255);
