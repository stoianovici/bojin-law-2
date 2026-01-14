-- AddClientIdToTasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "client_id" VARCHAR(255);
CREATE INDEX IF NOT EXISTS "tasks_client_id_idx" ON "tasks"("client_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_client_id_fkey'
    ) THEN
        ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
