-- OPS-240: Thread Summaries Processor
-- Add general summary fields to thread_summaries table for batch processing

-- Add overview field (1-2 sentence summary in Romanian)
ALTER TABLE "thread_summaries" ADD COLUMN "overview" TEXT;

-- Add key_points field (JSON array of bullet points)
ALTER TABLE "thread_summaries" ADD COLUMN "key_points" JSONB;

-- Add action_items field (JSON array of action items)
ALTER TABLE "thread_summaries" ADD COLUMN "action_items" JSONB;

-- Add sentiment field (positive/neutral/negative/urgent)
ALTER TABLE "thread_summaries" ADD COLUMN "sentiment" VARCHAR(20);

-- Add participants field (JSON array of participant names/emails)
ALTER TABLE "thread_summaries" ADD COLUMN "participants" JSONB;
