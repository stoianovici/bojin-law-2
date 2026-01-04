-- Replace Paralegal role with AssociateJr
-- First, update any existing users with Paralegal role to AssociateJr
UPDATE "users" SET "role" = 'Associate' WHERE "role" = 'Paralegal';

-- Add AssociateJr to the enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AssociateJr';
