-- OPS-257: Extend CaseBriefing Schema for Rich Context
-- Add new JSON fields for pre-compiled AI context sections

-- Document summaries (top document summaries)
ALTER TABLE "case_briefings" ADD COLUMN "document_summaries" JSONB;

-- Email thread summaries with action items
ALTER TABLE "case_briefings" ADD COLUMN "email_thread_summaries" JSONB;

-- Next 10 deadlines structured
ALTER TABLE "case_briefings" ADD COLUMN "upcoming_deadlines" JSONB;

-- Case contacts with last communication
ALTER TABLE "case_briefings" ADD COLUMN "contact_context" JSONB;

-- Client profile, portfolio, relationship
ALTER TABLE "case_briefings" ADD COLUMN "client_context" JSONB;

-- Risk flags, staleness warnings
ALTER TABLE "case_briefings" ADD COLUMN "case_health_indicators" JSONB;

-- Schema version for migrations (defaults to 1)
ALTER TABLE "case_briefings" ADD COLUMN "context_version" INTEGER NOT NULL DEFAULT 1;
