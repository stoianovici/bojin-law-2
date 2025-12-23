-- OPS-107: SharePoint GraphQL Schema Updates
-- Add SharePoint storage fields to Document model for migration support

-- Add SharePoint item ID field
ALTER TABLE "documents" ADD COLUMN "share_point_item_id" VARCHAR(255);

-- Add SharePoint path field
ALTER TABLE "documents" ADD COLUMN "share_point_path" TEXT;

-- Create index for SharePoint item ID lookup
CREATE INDEX "documents_share_point_item_id_idx" ON "documents"("share_point_item_id");
