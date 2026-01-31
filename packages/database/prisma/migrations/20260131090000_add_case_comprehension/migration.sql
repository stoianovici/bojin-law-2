-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "case_comprehensions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "current_picture" TEXT NOT NULL,
    "data_map" JSONB NOT NULL DEFAULT '{}',
    "content_critical" TEXT NOT NULL,
    "content_standard" TEXT NOT NULL,
    "tokens_full" INTEGER NOT NULL,
    "tokens_critical" INTEGER NOT NULL,
    "tokens_standard" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "generated_by" TEXT,
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "case_comprehensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprehension_corrections" (
    "id" TEXT NOT NULL,
    "comprehension_id" TEXT NOT NULL,
    "anchor_text" VARCHAR(500) NOT NULL,
    "anchor_hash" VARCHAR(64) NOT NULL,
    "correction_type" "CorrectionType" NOT NULL,
    "corrected_value" TEXT NOT NULL,
    "reason" TEXT,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprehension_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprehension_agent_runs" (
    "id" TEXT NOT NULL,
    "comprehension_id" TEXT,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "trigger" VARCHAR(50) NOT NULL,
    "trigger_event" VARCHAR(100),
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "tool_calls" JSONB NOT NULL DEFAULT '[]',
    "tokens_used" INTEGER,
    "model_id" VARCHAR(100),
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprehension_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_comprehensions_case_id_key" ON "case_comprehensions"("case_id");

-- CreateIndex
CREATE INDEX "case_comprehensions_firm_id_idx" ON "case_comprehensions"("firm_id");

-- CreateIndex
CREATE INDEX "case_comprehensions_is_stale_idx" ON "case_comprehensions"("is_stale");

-- CreateIndex
CREATE INDEX "case_comprehensions_valid_until_idx" ON "case_comprehensions"("valid_until");

-- CreateIndex
CREATE INDEX "comprehension_corrections_comprehension_id_idx" ON "comprehension_corrections"("comprehension_id");

-- CreateIndex
CREATE INDEX "comprehension_corrections_is_active_idx" ON "comprehension_corrections"("is_active");

-- CreateIndex
CREATE INDEX "comprehension_corrections_anchor_hash_idx" ON "comprehension_corrections"("anchor_hash");

-- CreateIndex
CREATE INDEX "comprehension_agent_runs_case_id_idx" ON "comprehension_agent_runs"("case_id");

-- CreateIndex
CREATE INDEX "comprehension_agent_runs_firm_id_idx" ON "comprehension_agent_runs"("firm_id");

-- CreateIndex
CREATE INDEX "comprehension_agent_runs_status_idx" ON "comprehension_agent_runs"("status");

-- CreateIndex
CREATE INDEX "comprehension_agent_runs_created_at_idx" ON "comprehension_agent_runs"("created_at");

-- AddForeignKey
ALTER TABLE "case_comprehensions" ADD CONSTRAINT "case_comprehensions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_comprehensions" ADD CONSTRAINT "case_comprehensions_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprehension_corrections" ADD CONSTRAINT "comprehension_corrections_comprehension_id_fkey" FOREIGN KEY ("comprehension_id") REFERENCES "case_comprehensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprehension_agent_runs" ADD CONSTRAINT "comprehension_agent_runs_comprehension_id_fkey" FOREIGN KEY ("comprehension_id") REFERENCES "case_comprehensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
