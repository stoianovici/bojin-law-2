-- AlterTable - Add client_id to mape and make case_id nullable
ALTER TABLE "mape" ADD COLUMN "client_id" TEXT;
ALTER TABLE "mape" ALTER COLUMN "case_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "mape_client_id_idx" ON "mape"("client_id");

-- AddForeignKey
ALTER TABLE "mape" ADD CONSTRAINT "mape_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
