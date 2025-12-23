-- OPS-115: AI Context Files - Data Model
-- Creates tables for tracking user activity events, daily context, and case briefings

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM (
  'EMAIL_RECEIVED',
  'EMAIL_CLASSIFIED',
  'EMAIL_FROM_COURT',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_SHARED',
  'TASK_ASSIGNED',
  'TASK_DUE_TODAY',
  'TASK_OVERDUE',
  'TASK_COMPLETED',
  'CASE_DEADLINE_APPROACHING',
  'CASE_HEARING_TODAY',
  'CASE_STATUS_CHANGED',
  'CALENDAR_EVENT_TODAY',
  'CALENDAR_EVENT_REMINDER'
);

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM (
  'EMAIL',
  'DOCUMENT',
  'TASK',
  'CASE',
  'CALENDAR_EVENT'
);

-- CreateEnum
CREATE TYPE "EventImportance" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- CreateTable: user_activity_events
CREATE TABLE "user_activity_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "firm_id" TEXT NOT NULL,
  "event_type" "ActivityEventType" NOT NULL,
  "entity_type" "ActivityEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "entity_title" VARCHAR(500),
  "metadata" JSONB,
  "importance" "EventImportance" NOT NULL DEFAULT 'NORMAL',
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "seen_at" TIMESTAMPTZ,
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_daily_contexts
CREATE TABLE "user_daily_contexts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "firm_id" TEXT NOT NULL,
  "context_data" JSONB NOT NULL,
  "last_computed_at" TIMESTAMPTZ NOT NULL,
  "last_briefing_at" TIMESTAMPTZ,
  "last_seen_event_id" TEXT,
  "valid_until" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "user_daily_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: case_briefings
CREATE TABLE "case_briefings" (
  "id" TEXT NOT NULL,
  "case_id" TEXT NOT NULL,
  "firm_id" TEXT NOT NULL,
  "briefing_text" TEXT NOT NULL,
  "briefing_data" JSONB NOT NULL,
  "last_computed_at" TIMESTAMPTZ NOT NULL,
  "valid_until" TIMESTAMPTZ NOT NULL,
  "last_email_at" TIMESTAMPTZ,
  "last_document_at" TIMESTAMPTZ,
  "last_task_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "case_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: user_activity_events
CREATE INDEX "user_activity_events_user_id_notified_occurred_at_idx" ON "user_activity_events"("user_id", "notified", "occurred_at");
CREATE INDEX "user_activity_events_user_id_event_type_occurred_at_idx" ON "user_activity_events"("user_id", "event_type", "occurred_at");
CREATE INDEX "user_activity_events_firm_id_occurred_at_idx" ON "user_activity_events"("firm_id", "occurred_at");

-- CreateIndex: user_daily_contexts
CREATE UNIQUE INDEX "user_daily_contexts_user_id_key" ON "user_daily_contexts"("user_id");
CREATE INDEX "user_daily_contexts_user_id_idx" ON "user_daily_contexts"("user_id");
CREATE INDEX "user_daily_contexts_valid_until_idx" ON "user_daily_contexts"("valid_until");

-- CreateIndex: case_briefings
CREATE UNIQUE INDEX "case_briefings_case_id_key" ON "case_briefings"("case_id");
CREATE INDEX "case_briefings_case_id_idx" ON "case_briefings"("case_id");
CREATE INDEX "case_briefings_valid_until_idx" ON "case_briefings"("valid_until");

-- AddForeignKey: user_activity_events
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_daily_contexts
ALTER TABLE "user_daily_contexts" ADD CONSTRAINT "user_daily_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: case_briefings
ALTER TABLE "case_briefings" ADD CONSTRAINT "case_briefings_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
