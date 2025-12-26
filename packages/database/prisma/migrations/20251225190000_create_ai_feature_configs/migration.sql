-- CreateTable: AI Feature Configs
-- OPS-243: Feature Toggles Page
-- Controls AI feature enable/disable and per-feature settings

CREATE TABLE IF NOT EXISTS "ai_feature_configs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "feature" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthly_budget_eur" DECIMAL(10,2),
    "daily_limit_eur" DECIMAL(10,2),
    "schedule" VARCHAR(50),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "ai_feature_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_feature_configs_firm_id_feature_key" ON "ai_feature_configs"("firm_id", "feature");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_feature_configs_firm_id_idx" ON "ai_feature_configs"("firm_id");
