-- Add stale_since field to track when comprehension became stale
-- Used for prioritizing batch regeneration (oldest stale first)
ALTER TABLE "case_comprehensions" ADD COLUMN "stale_since" TIMESTAMPTZ(6);

-- Index for efficient ordering in batch regeneration
CREATE INDEX "case_comprehensions_stale_since_idx" ON "case_comprehensions"("stale_since");
