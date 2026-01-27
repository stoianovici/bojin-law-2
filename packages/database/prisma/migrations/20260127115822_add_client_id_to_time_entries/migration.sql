-- CreateEnum
CREATE TYPE "SkipReason" AS ENUM ('Scanned', 'Duplicate', 'Empty', 'Corrupted');

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "client_id" TEXT,
ALTER COLUMN "case_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "time_entries_client_id_idx" ON "time_entries"("client_id");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
