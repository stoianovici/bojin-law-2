-- OPS-046: Case Summary Data Model
-- Creates CaseSummary and CaseEvent tables for persistent AI summaries and unified chronology

-- CreateEnum: CaseEventType
CREATE TYPE "CaseEventType" AS ENUM (
    'DocumentUploaded',
    'DocumentSigned',
    'DocumentDeleted',
    'EmailReceived',
    'EmailSent',
    'EmailCourt',
    'NoteCreated',
    'NoteUpdated',
    'TaskCreated',
    'TaskCompleted',
    'CaseStatusChanged',
    'TeamMemberAdded',
    'ContactAdded'
);

-- CreateEnum: EventImportance
CREATE TYPE "EventImportance" AS ENUM ('High', 'Medium', 'Low');

-- CreateTable: case_summaries
CREATE TABLE "case_summaries" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "current_status" TEXT NOT NULL,
    "key_developments" JSONB NOT NULL DEFAULT '[]',
    "open_issues" JSONB NOT NULL DEFAULT '[]',
    "generated_at" TIMESTAMPTZ NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "data_version_hash" TEXT,
    "email_count" INTEGER NOT NULL DEFAULT 0,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "note_count" INTEGER NOT NULL DEFAULT 0,
    "task_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "case_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: case_events
CREATE TABLE "case_events" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "event_type" "CaseEventType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "importance" "EventImportance" NOT NULL DEFAULT 'Medium',
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: case_summaries unique on case_id
CREATE UNIQUE INDEX "case_summaries_case_id_key" ON "case_summaries"("case_id");

-- CreateIndex: case_summaries indexes
CREATE INDEX "case_summaries_case_id_idx" ON "case_summaries"("case_id");
CREATE INDEX "case_summaries_is_stale_idx" ON "case_summaries"("is_stale");

-- CreateIndex: case_events unique constraint (prevents duplicate events)
CREATE UNIQUE INDEX "case_events_event_type_source_id_key" ON "case_events"("event_type", "source_id");

-- CreateIndex: case_events indexes
CREATE INDEX "case_events_case_id_occurred_at_idx" ON "case_events"("case_id", "occurred_at");
CREATE INDEX "case_events_case_id_importance_idx" ON "case_events"("case_id", "importance");

-- AddForeignKey: case_summaries -> cases
ALTER TABLE "case_summaries" ADD CONSTRAINT "case_summaries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: case_events -> cases
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: case_events -> users (actor)
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
