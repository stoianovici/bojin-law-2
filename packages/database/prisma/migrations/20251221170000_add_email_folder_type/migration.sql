-- AlterTable: Add folder_type field to track inbox vs sent (OPS-091)
ALTER TABLE "emails" ADD COLUMN "folder_type" VARCHAR(10);

-- CreateIndex: Index on folder_type for efficient filtering
CREATE INDEX "emails_folder_type_idx" ON "emails"("folder_type");

-- Backfill: Set existing emails to 'inbox' (they were all synced from inbox)
UPDATE "emails" SET "folder_type" = 'inbox' WHERE "folder_type" IS NULL;
