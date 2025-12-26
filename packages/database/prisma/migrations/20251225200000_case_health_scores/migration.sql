-- OPS-239: Case Health Scoring Processor
-- Creates table for nightly-computed case health metrics

-- CreateTable
CREATE TABLE "case_health_scores" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "activity_score" INTEGER NOT NULL,
    "email_score" INTEGER NOT NULL,
    "task_score" INTEGER NOT NULL,
    "deadline_score" INTEGER NOT NULL,
    "concerns" TEXT[],
    "suggestions" TEXT[],
    "risk_level" VARCHAR(20) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_health_scores_firm_id_calculated_at_idx" ON "case_health_scores"("firm_id", "calculated_at");

-- CreateIndex
CREATE INDEX "case_health_scores_case_id_idx" ON "case_health_scores"("case_id");

-- CreateIndex
CREATE INDEX "case_health_scores_score_idx" ON "case_health_scores"("score");

-- AddForeignKey
ALTER TABLE "case_health_scores" ADD CONSTRAINT "case_health_scores_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
