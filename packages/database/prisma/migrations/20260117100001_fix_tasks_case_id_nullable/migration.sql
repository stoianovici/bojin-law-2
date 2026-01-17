-- AlterTable - Make case_id nullable and fix client_id type for tasks table
ALTER TABLE "tasks" ALTER COLUMN "case_id" DROP NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "client_id" SET DATA TYPE TEXT;

-- Update foreign key to use CASCADE instead of RESTRICT for case deletion
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_case_id_fkey";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
