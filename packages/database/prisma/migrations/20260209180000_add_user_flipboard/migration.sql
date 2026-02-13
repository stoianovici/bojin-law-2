-- CreateTable
CREATE TABLE "user_flipboards" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_eur" DOUBLE PRECISION,
    "is_refreshing" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshed_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_flipboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_flipboard_runs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trigger_type" VARCHAR(50) NOT NULL,
    "trigger_event_type" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_eur" DOUBLE PRECISION,
    "tool_calls" JSONB,
    "error" TEXT,

    CONSTRAINT "user_flipboard_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_flipboards_user_id_key" ON "user_flipboards"("user_id");

-- CreateIndex
CREATE INDEX "user_flipboards_firm_id_idx" ON "user_flipboards"("firm_id");

-- CreateIndex
CREATE INDEX "user_flipboards_user_id_idx" ON "user_flipboards"("user_id");

-- CreateIndex
CREATE INDEX "user_flipboard_runs_firm_id_started_at_idx" ON "user_flipboard_runs"("firm_id", "started_at");

-- CreateIndex
CREATE INDEX "user_flipboard_runs_user_id_started_at_idx" ON "user_flipboard_runs"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "user_flipboard_runs_status_idx" ON "user_flipboard_runs"("status");

-- AddForeignKey
ALTER TABLE "user_flipboards" ADD CONSTRAINT "user_flipboards_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flipboards" ADD CONSTRAINT "user_flipboards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flipboard_runs" ADD CONSTRAINT "user_flipboard_runs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flipboard_runs" ADD CONSTRAINT "user_flipboard_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
