-- OPS-104: Add oneDriveUserId field to Document model
-- This field stores the MS Graph user ID of the OneDrive owner
-- Required for cross-user document access (preview/download)

ALTER TABLE "documents" ADD COLUMN "one_drive_user_id" VARCHAR(255);

-- Backfill existing documents that have OneDrive IDs
-- Set oneDriveUserId to the uploader's Azure AD ID
UPDATE "documents" d
SET "one_drive_user_id" = u."azure_ad_id"
FROM "users" u
WHERE d."uploaded_by" = u."id"
  AND d."one_drive_id" IS NOT NULL
  AND d."one_drive_user_id" IS NULL;
