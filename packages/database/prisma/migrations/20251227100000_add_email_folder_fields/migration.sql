-- Add folder tracking fields to emails table
-- Allows syncing from all Outlook folders, not just Inbox/Sent

ALTER TABLE "emails" ADD COLUMN "parent_folder_id" VARCHAR(255);
ALTER TABLE "emails" ADD COLUMN "parent_folder_name" VARCHAR(255);

-- Create index for filtering by folder
CREATE INDEX "emails_parent_folder_name_idx" ON "emails"("parent_folder_name");
