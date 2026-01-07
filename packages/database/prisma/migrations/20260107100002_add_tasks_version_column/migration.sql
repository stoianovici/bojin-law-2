-- Add version column to tasks table (fixing production schema drift)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
