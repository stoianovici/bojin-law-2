-- OPS-172: Extend DocumentStatus enum with review workflow states
-- Add IN_REVIEW and CHANGES_REQUESTED states for supervisor review workflow

-- Add new enum values to DocumentStatus
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
