-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('InvoiceCreated', 'InvoiceCancelled', 'InvoicePaid', 'FixedAmountChanged', 'RetainerAmountChanged');

-- CreateTable
CREATE TABLE "case_billing_history" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "event_type" "BillingEventType" NOT NULL,
    "billing_type" "BillingType" NOT NULL,
    "amount_eur" DECIMAL(15,2) NOT NULL,
    "previous_amount_eur" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "case_billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_billing_history_case_id_idx" ON "case_billing_history"("case_id");

-- CreateIndex
CREATE INDEX "case_billing_history_invoice_id_idx" ON "case_billing_history"("invoice_id");

-- CreateIndex
CREATE INDEX "case_billing_history_firm_id_idx" ON "case_billing_history"("firm_id");

-- CreateIndex
CREATE INDEX "case_billing_history_created_at_idx" ON "case_billing_history"("created_at");

-- CreateIndex
CREATE INDEX "case_billing_history_event_type_idx" ON "case_billing_history"("event_type");

-- AddForeignKey
ALTER TABLE "case_billing_history" ADD CONSTRAINT "case_billing_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_billing_history" ADD CONSTRAINT "case_billing_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_billing_history" ADD CONSTRAINT "case_billing_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_billing_history" ADD CONSTRAINT "case_billing_history_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
