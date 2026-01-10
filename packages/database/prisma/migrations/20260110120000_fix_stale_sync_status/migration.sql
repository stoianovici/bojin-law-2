-- Fix cases with stale sync status that have no active sync jobs
-- This addresses cases that existed before the sync feature was added,
-- or cases where sync jobs failed to queue properly.

UPDATE cases c
SET sync_status = 'Completed'
WHERE c.sync_status IN ('Pending', 'Syncing')
AND NOT EXISTS (
  SELECT 1 FROM historical_email_sync_jobs h
  WHERE h.case_id = c.id
  AND h.status IN ('Pending', 'InProgress')
);
