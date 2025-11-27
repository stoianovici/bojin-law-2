-- Validation Script for Billing & Rate Management Migration
-- Story 2.8.1 - Task 21
--
-- This script validates that the billing migration was applied correctly
-- Run this after the migration to verify data integrity

-- 1. Check all cases have a billing type
SELECT
  COUNT(*) as total_cases,
  COUNT(billing_type) as cases_with_billing_type
FROM cases;
-- Expected: total_cases = cases_with_billing_type

-- 2. Verify billing type distribution
SELECT
  billing_type,
  COUNT(*) as count
FROM cases
GROUP BY billing_type;
-- Expected: All existing cases should show 'Hourly' (from DEFAULT)

-- 3. Check Fixed cases have fixedAmount
SELECT
  COUNT(*) as fixed_cases_without_amount
FROM cases
WHERE billing_type = 'Fixed' AND fixed_amount IS NULL;
-- Expected: 0 (Fixed cases must have a fixed amount)

-- 4. Verify custom_rates structure (if any exist)
SELECT
  id,
  billing_type,
  custom_rates
FROM cases
WHERE custom_rates IS NOT NULL
LIMIT 5;
-- Inspect: Should have valid JSON with partnerRate, associateRate, paralegalRate

-- 5. Check rate history table exists and is empty initially
SELECT COUNT(*) as rate_history_count
FROM case_rate_history;
-- Expected: 0 (new migration, no history yet)

-- 6. Verify foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('cases', 'case_rate_history', 'firms');
-- Expected: See all foreign keys from migration

-- 7. Verify indexes exist
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('case_rate_history')
ORDER BY tablename, indexname;
-- Expected: Indexes on case_id, changed_at, firm_id

-- 8. Check enum types exist
SELECT
  t.typname,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('BillingType', 'RateType')
GROUP BY t.typname;
-- Expected:
--   BillingType: Hourly, Fixed
--   RateType: partner, associate, paralegal, fixed

-- SUCCESS MESSAGE
SELECT 'Migration validation complete!' as status;
