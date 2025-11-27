-- Rollback Script for Billing & Rate Management Migration
-- Story 2.8.1 - Task 21
--
-- WARNING: This script will remove all billing data!
-- Only use in case of critical migration failure
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT

-- 1. Drop foreign key constraints
ALTER TABLE "case_rate_history" DROP CONSTRAINT IF EXISTS "case_rate_history_firm_id_fkey";
ALTER TABLE "case_rate_history" DROP CONSTRAINT IF EXISTS "case_rate_history_changed_by_fkey";
ALTER TABLE "case_rate_history" DROP CONSTRAINT IF EXISTS "case_rate_history_case_id_fkey";

-- 2. Drop indexes
DROP INDEX IF EXISTS "case_rate_history_firm_id_idx";
DROP INDEX IF EXISTS "case_rate_history_changed_at_idx";
DROP INDEX IF EXISTS "case_rate_history_case_id_idx";

-- 3. Drop rate history table
DROP TABLE IF EXISTS "case_rate_history";

-- 4. Remove billing columns from cases table
ALTER TABLE "cases" DROP CONSTRAINT IF EXISTS "cases_firm_id_fkey";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "custom_rates";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "fixed_amount";
ALTER TABLE "cases" DROP COLUMN IF EXISTS "billing_type";

-- 5. Remove firm foreign keys from other tables
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_firm_id_fkey";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_firm_id_fkey";
ALTER TABLE "users" DROP COLUMN IF EXISTS "firm_id";

-- 6. Drop firms table
DROP TABLE IF EXISTS "firms";

-- 7. Drop enum types
DROP TYPE IF EXISTS "RateType";
DROP TYPE IF EXISTS "BillingType";

-- Rollback complete message
SELECT 'Rollback complete. Billing features removed.' as status;

-- IMPORTANT: After rollback, you may need to:
-- 1. Restore from backup if data was lost
-- 2. Re-run the forward migration after fixing issues
-- 3. Update application code to handle missing billing fields
