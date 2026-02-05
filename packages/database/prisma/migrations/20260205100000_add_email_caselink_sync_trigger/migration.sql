-- Email Case Link Sync Trigger
--
-- Automatically keeps Email.caseId in sync with the primary EmailCaseLink.
-- This ensures the legacy Email.caseId field always matches the primary case
-- from the EmailCaseLink relationship.

-- ============================================================================
-- Trigger function: sync Email.caseId from primary EmailCaseLink on INSERT/UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_email_case_id()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT/UPDATE of EmailCaseLink with isPrimary=true
  IF NEW.is_primary = true THEN
    UPDATE emails SET case_id = NEW.case_id WHERE id = NEW.email_id;
  END IF;

  -- On UPDATE where isPrimary changed from true to false
  IF TG_OP = 'UPDATE' AND OLD.is_primary = true AND NEW.is_primary = false THEN
    -- Find new primary or set to NULL
    UPDATE emails SET case_id = (
      SELECT case_id FROM email_case_links
      WHERE email_id = NEW.email_id AND is_primary = true
      LIMIT 1
    ) WHERE id = NEW.email_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger on email_case_links for INSERT/UPDATE
-- ============================================================================
CREATE TRIGGER email_case_link_sync_trigger
AFTER INSERT OR UPDATE ON email_case_links
FOR EACH ROW EXECUTE FUNCTION sync_email_case_id();

-- ============================================================================
-- Trigger function: handle DELETE - clear Email.caseId if primary link deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_email_case_id_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_primary = true THEN
    -- Find a new primary link or set to NULL
    UPDATE emails SET case_id = (
      SELECT case_id FROM email_case_links
      WHERE email_id = OLD.email_id AND is_primary = true
      LIMIT 1
    ) WHERE id = OLD.email_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger on email_case_links for DELETE
-- ============================================================================
CREATE TRIGGER email_case_link_delete_trigger
AFTER DELETE ON email_case_links
FOR EACH ROW EXECUTE FUNCTION sync_email_case_id_on_delete();
