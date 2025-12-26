-- Fix email attachment documents that were incorrectly classified as UPLOAD
-- This updates documents where metadata indicates they came from email attachments
-- but source_type was not set correctly (defaulted to UPLOAD)

UPDATE documents
SET source_type = 'EMAIL_ATTACHMENT'
WHERE source_type = 'UPLOAD'
  AND (
    metadata->>'source' = 'email_attachment'
    OR metadata->>'category' = 'Email Attachment'
  );
