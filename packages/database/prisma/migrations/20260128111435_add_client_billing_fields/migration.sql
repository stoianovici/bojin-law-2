-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "billing_type" "BillingType" DEFAULT 'Hourly',
ADD COLUMN     "custom_rates" JSONB,
ADD COLUMN     "fixed_amount" DECIMAL(15,2),
ADD COLUMN     "retainer_amount" DECIMAL(15,2),
ADD COLUMN     "retainer_auto_renew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retainer_period" "RetainerPeriod",
ADD COLUMN     "retainer_rollover" BOOLEAN NOT NULL DEFAULT false;
