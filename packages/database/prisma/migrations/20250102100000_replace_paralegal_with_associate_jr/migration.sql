-- Replace Paralegal role with AssociateJr
-- Made idempotent: skips if users table or UserRole enum don't exist yet
-- (this migration was timestamped before its dependencies)

DO $$
BEGIN
  -- Update existing users with Paralegal role to Associate
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    UPDATE "users" SET "role" = 'Associate' WHERE "role" = 'Paralegal';
  END IF;
END $$;

-- Add AssociateJr to the enum (only if enum exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    EXECUTE 'ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS ''AssociateJr''';
  END IF;
END $$;
