-- OPS-195: Add new ClassificationAction enum values for confirmation flow

-- Create the enum if it doesn't exist (for shadow database compatibility)
-- The enum might already exist in production but needs to be created from scratch in shadow DB
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassificationAction') THEN
        CREATE TYPE "ClassificationAction" AS ENUM (
            'Assigned',
            'Moved',
            'Ignored',
            'Unassigned',
            'MANUAL_COURT_ASSIGN',
            'MANUAL_IGNORE',
            'MANUAL_CLASSIFY',
            'MANUAL_LINK',
            'MANUAL_UNLINK',
            'CONFIRMED',
            'MANUAL_REASSIGN'
        );
    END IF;
END$$;

-- Add CONFIRMED if enum exists but doesn't have the value (for existing databases)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassificationAction') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIRMED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ClassificationAction')) THEN
            EXECUTE 'ALTER TYPE "ClassificationAction" ADD VALUE ''CONFIRMED''';
        END IF;
    END IF;
END$$;

-- Add MANUAL_REASSIGN if enum exists but doesn't have the value (for existing databases)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassificationAction') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MANUAL_REASSIGN' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ClassificationAction')) THEN
            EXECUTE 'ALTER TYPE "ClassificationAction" ADD VALUE ''MANUAL_REASSIGN''';
        END IF;
    END IF;
END$$;
