-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('Active', 'OnHold', 'Closed', 'Archived');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('Litigation', 'Contract', 'Advisory', 'Criminal', 'Other');

-- CreateEnum
CREATE TYPE "CaseActorRole" AS ENUM ('Client', 'OpposingParty', 'OpposingCounsel', 'Witness', 'Expert');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contact_info" JSONB NOT NULL DEFAULT '{}',
    "address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "firm_id" TEXT NOT NULL,
    "case_number" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'Active',
    "type" "CaseType" NOT NULL,
    "description" TEXT NOT NULL,
    "opened_date" DATE NOT NULL,
    "closed_date" DATE,
    "value" DECIMAL(15,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_team" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "case_team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_audit_logs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "field_name" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_actors" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "role" "CaseActorRole" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "organization" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "case_actors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clients_firm_id_idx" ON "clients"("firm_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_firm_id_name_key" ON "clients"("firm_id", "name");

-- CreateIndex
CREATE INDEX "cases_firm_id_idx" ON "cases"("firm_id");

-- CreateIndex
CREATE INDEX "cases_client_id_idx" ON "cases"("client_id");

-- CreateIndex
CREATE INDEX "cases_status_idx" ON "cases"("status");

-- CreateIndex
CREATE INDEX "cases_opened_date_idx" ON "cases"("opened_date");

-- CreateIndex
CREATE UNIQUE INDEX "cases_firm_id_case_number_key" ON "cases"("firm_id", "case_number");

-- CreateIndex
CREATE INDEX "case_team_case_id_idx" ON "case_team"("case_id");

-- CreateIndex
CREATE INDEX "case_team_user_id_idx" ON "case_team"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_team_case_id_user_id_key" ON "case_team"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "case_audit_logs_case_id_idx" ON "case_audit_logs"("case_id");

-- CreateIndex
CREATE INDEX "case_audit_logs_timestamp_idx" ON "case_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "case_actors_case_id_idx" ON "case_actors"("case_id");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team" ADD CONSTRAINT "case_team_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team" ADD CONSTRAINT "case_team_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_team" ADD CONSTRAINT "case_team_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_audit_logs" ADD CONSTRAINT "case_audit_logs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_audit_logs" ADD CONSTRAINT "case_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_actors" ADD CONSTRAINT "case_actors_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_actors" ADD CONSTRAINT "case_actors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
