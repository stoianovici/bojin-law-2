-- CreateTable: AI Usage Log
-- Tracks every AI API call for cost monitoring with EUR precision
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "feature" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_eur" DECIMAL(10,6) NOT NULL,
    "user_id" TEXT,
    "firm_id" TEXT NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batch_job_id" TEXT,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AI Batch Job Run
-- Tracks batch processing job executions
CREATE TABLE "ai_batch_job_runs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "feature" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_eur" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "ai_batch_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_firm_id_created_at_idx" ON "ai_usage_logs"("firm_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_batch_job_id_idx" ON "ai_usage_logs"("batch_job_id");

-- CreateIndex
CREATE INDEX "ai_batch_job_runs_firm_id_feature_started_at_idx" ON "ai_batch_job_runs"("firm_id", "feature", "started_at");

-- CreateIndex
CREATE INDEX "ai_batch_job_runs_status_idx" ON "ai_batch_job_runs"("status");
