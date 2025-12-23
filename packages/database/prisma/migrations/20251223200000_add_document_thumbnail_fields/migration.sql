-- CreateEnum
CREATE TYPE "ThumbnailStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NOT_SUPPORTED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "thumbnail_small_url" TEXT,
ADD COLUMN "thumbnail_medium_url" TEXT,
ADD COLUMN "thumbnail_large_url" TEXT,
ADD COLUMN "thumbnail_status" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "thumbnail_error" VARCHAR(500);

-- CreateIndex
CREATE INDEX "documents_thumbnail_status_idx" ON "documents"("thumbnail_status");
