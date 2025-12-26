-- CreateTable: AI Budget Settings
-- OPS-246: Budget Controls & Alerts Page

CREATE TABLE "ai_budget_settings" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "monthly_budget_eur" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "alert_at_75_percent" BOOLEAN NOT NULL DEFAULT true,
    "alert_at_90_percent" BOOLEAN NOT NULL DEFAULT true,
    "auto_pause_at_100_percent" BOOLEAN NOT NULL DEFAULT false,
    "slack_webhook_url" VARCHAR(500),
    "alerts_sent_this_month" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_alert_reset_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "ai_budget_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_budget_settings_firm_id_key" ON "ai_budget_settings"("firm_id");
