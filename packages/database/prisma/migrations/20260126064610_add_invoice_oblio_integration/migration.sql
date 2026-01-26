-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Issued', 'Paid', 'PartiallyPaid', 'Cancelled', 'Overdue');

-- CreateEnum
CREATE TYPE "EFacturaStatus" AS ENUM ('Pending', 'Submitted', 'Accepted', 'Rejected', 'Error');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('TimeEntry', 'Fixed', 'Expense', 'Discount', 'Manual');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "invoice_id" TEXT,
ADD COLUMN     "invoiced_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "oblio_configs" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "company_cif" VARCHAR(20) NOT NULL,
    "default_series" VARCHAR(20) NOT NULL,
    "work_station" VARCHAR(100),
    "is_vat_payer" BOOLEAN NOT NULL DEFAULT true,
    "default_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "default_due_days" INTEGER NOT NULL DEFAULT 30,
    "exchange_rate_source" VARCHAR(20) NOT NULL DEFAULT 'BNR',
    "auto_submit_efactura" BOOLEAN NOT NULL DEFAULT false,
    "last_tested_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "oblio_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "case_id" TEXT,
    "oblio_series" VARCHAR(20),
    "oblio_number" INTEGER,
    "oblio_document_id" VARCHAR(100),
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "original_currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
    "invoice_currency" VARCHAR(3) NOT NULL DEFAULT 'RON',
    "exchange_rate" DECIMAL(10,6),
    "exchange_rate_date" DATE,
    "exchange_rate_source" VARCHAR(20),
    "subtotal_eur" DECIMAL(15,2) NOT NULL,
    "subtotal_ron" DECIMAL(15,2),
    "vat_amount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "efactura_status" "EFacturaStatus",
    "efactura_id" VARCHAR(100),
    "efactura_submitted_at" TIMESTAMPTZ(6),
    "efactura_error" TEXT,
    "notes" TEXT,
    "internal_note" TEXT,
    "pdf_url" TEXT,
    "created_by_id" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "line_type" "LineItemType" NOT NULL,
    "original_hours" DECIMAL(10,2),
    "original_rate_eur" DECIMAL(15,2),
    "quantity" DECIMAL(10,2) NOT NULL,
    "measuring_unit" VARCHAR(20) NOT NULL DEFAULT 'ore',
    "unit_price_eur" DECIMAL(15,2) NOT NULL,
    "unit_price_ron" DECIMAL(15,2),
    "amount_eur" DECIMAL(15,2) NOT NULL,
    "amount_ron" DECIMAL(15,2),
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "vat_amount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "was_adjusted" BOOLEAN NOT NULL DEFAULT false,
    "adjustment_note" TEXT,
    "time_entry_id" TEXT,
    "task_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oblio_configs_firm_id_key" ON "oblio_configs"("firm_id");

-- CreateIndex
CREATE INDEX "invoices_firm_id_idx" ON "invoices"("firm_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_firm_id_oblio_series_oblio_number_key" ON "invoices"("firm_id", "oblio_series", "oblio_number");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_time_entry_id_idx" ON "invoice_line_items"("time_entry_id");

-- CreateIndex
CREATE INDEX "invoice_line_items_task_id_idx" ON "invoice_line_items"("task_id");

-- CreateIndex
CREATE INDEX "tasks_invoice_id_idx" ON "tasks"("invoice_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oblio_configs" ADD CONSTRAINT "oblio_configs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
