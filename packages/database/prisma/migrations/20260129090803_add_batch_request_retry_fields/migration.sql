-- AlterTable
ALTER TABLE "ai_batch_requests" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ai_batch_requests" ADD COLUMN "last_retry_at" TIMESTAMPTZ(6);
