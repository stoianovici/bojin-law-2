-- CreateEnum
CREATE TYPE "RetainerPeriod" AS ENUM ('Monthly', 'Quarterly', 'Annually');

-- AlterEnum
ALTER TYPE "BillingType" ADD VALUE 'Retainer';

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "retainer_amount" DECIMAL(15,2),
ADD COLUMN     "retainer_auto_renew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retainer_period" "RetainerPeriod",
ADD COLUMN     "retainer_rollover" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "retainer_period_usage" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "hours_used" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hours_included" DECIMAL(10,2) NOT NULL,
    "rolled_over" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "retainer_period_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retainer_period_usage_case_id_idx" ON "retainer_period_usage"("case_id");

-- CreateIndex
CREATE INDEX "retainer_period_usage_firm_id_idx" ON "retainer_period_usage"("firm_id");

-- CreateIndex
CREATE INDEX "retainer_period_usage_period_start_idx" ON "retainer_period_usage"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "retainer_period_usage_case_id_period_start_key" ON "retainer_period_usage"("case_id", "period_start");

-- AddForeignKey
ALTER TABLE "retainer_period_usage" ADD CONSTRAINT "retainer_period_usage_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retainer_period_usage" ADD CONSTRAINT "retainer_period_usage_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
