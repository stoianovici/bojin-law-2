-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_date" DATE;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_start_time" VARCHAR(5);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_firm_id_scheduled_date_status_idx" ON "tasks"("firm_id", "scheduled_date", "status");
