-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('Hourly', 'Fixed');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CasePendingApproval', 'CaseApproved', 'CaseRejected');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('partner', 'associate', 'paralegal', 'fixed');

-- AlterEnum
ALTER TYPE "CaseStatus" ADD VALUE 'PendingApproval';

-- DropIndex
DROP INDEX "idx_cases_description_trgm";

-- DropIndex
DROP INDEX "idx_cases_title_trgm";

-- DropIndex
DROP INDEX "idx_clients_name_trgm";

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "billing_type" "BillingType" NOT NULL DEFAULT 'Hourly',
ADD COLUMN     "custom_rates" JSONB,
ADD COLUMN     "fixed_amount" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "database_health" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "database_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firms" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "default_rates" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_approvals" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'Pending',
    "rejection_reason" TEXT,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "firm_id" TEXT NOT NULL,

    CONSTRAINT "case_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "link" VARCHAR(500),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "case_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_rate_history" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT NOT NULL,
    "rate_type" "RateType" NOT NULL,
    "old_rate" DECIMAL(15,2) NOT NULL,
    "new_rate" DECIMAL(15,2) NOT NULL,
    "firm_id" TEXT NOT NULL,

    CONSTRAINT "case_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_approvals_case_id_key" ON "case_approvals"("case_id");

-- CreateIndex
CREATE INDEX "case_approvals_case_id_idx" ON "case_approvals"("case_id");

-- CreateIndex
CREATE INDEX "case_approvals_status_idx" ON "case_approvals"("status");

-- CreateIndex
CREATE INDEX "case_approvals_submitted_by_idx" ON "case_approvals"("submitted_by");

-- CreateIndex
CREATE INDEX "case_approvals_firm_id_idx" ON "case_approvals"("firm_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "case_rate_history_case_id_idx" ON "case_rate_history"("case_id");

-- CreateIndex
CREATE INDEX "case_rate_history_changed_at_idx" ON "case_rate_history"("changed_at");

-- CreateIndex
CREATE INDEX "case_rate_history_firm_id_idx" ON "case_rate_history"("firm_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approvals" ADD CONSTRAINT "case_approvals_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_rate_history" ADD CONSTRAINT "case_rate_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_rate_history" ADD CONSTRAINT "case_rate_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_rate_history" ADD CONSTRAINT "case_rate_history_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
