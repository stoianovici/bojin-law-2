-- Reclassify all emails using the new AI-powered classification pipeline
-- Keeps Ignored emails unchanged, resets everything else to Pending

UPDATE "emails"
SET
  "classification_state" = 'Pending',
  "classification_confidence" = NULL,
  "classified_at" = NULL,
  "classified_by" = NULL,
  "classification_reason" = NULL,
  "ai_classification_cost" = NULL,
  "case_id" = NULL,
  "client_id" = NULL
WHERE "classification_state" != 'Ignored';

-- Log the count of emails reset
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reset_count FROM "emails" WHERE "classification_state" = 'Pending';
  RAISE NOTICE 'Reset % emails to Pending for reclassification', reset_count;
END $$;
