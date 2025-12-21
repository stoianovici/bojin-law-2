-- Drop case_events table and related enums (OPS-063: Remove chronology feature)
-- This migration removes the case events chronology feature that was implemented in 20251219120000

-- Drop the case_events table
DROP TABLE IF EXISTS "case_events";

-- Drop the enum types
DROP TYPE IF EXISTS "CaseEventType";
DROP TYPE IF EXISTS "EventImportance";
