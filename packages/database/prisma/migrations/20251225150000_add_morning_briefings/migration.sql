-- CreateTable
CREATE TABLE "morning_briefings" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "briefing_date" DATE NOT NULL,
    "prioritized_tasks" JSONB NOT NULL,
    "key_deadlines" JSONB NOT NULL,
    "risk_alerts" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "is_viewed" BOOLEAN NOT NULL DEFAULT false,
    "viewed_at" TIMESTAMPTZ,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens_used" INTEGER NOT NULL,

    CONSTRAINT "morning_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "morning_briefings_firm_id_idx" ON "morning_briefings"("firm_id");

-- CreateIndex
CREATE INDEX "morning_briefings_user_id_idx" ON "morning_briefings"("user_id");

-- CreateIndex
CREATE INDEX "morning_briefings_briefing_date_idx" ON "morning_briefings"("briefing_date");

-- CreateIndex
CREATE UNIQUE INDEX "morning_briefings_user_id_briefing_date_key" ON "morning_briefings"("user_id", "briefing_date");

-- AddForeignKey
ALTER TABLE "morning_briefings" ADD CONSTRAINT "morning_briefings_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "morning_briefings" ADD CONSTRAINT "morning_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
