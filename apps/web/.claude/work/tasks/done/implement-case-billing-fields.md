# Implementation: Wire Case Billing & Classification Fields

**Status**: Complete
**Date**: 2026-01-02
**Input**: `plan-case-billing-fields.md`
**Next step**: `/commit` or more work

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint config missing (not blocking)

## Files Changed

| File                                           | Action   | Purpose                                                                                      |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `src/graphql/queries.ts`                       | Modified | Added `billingType`, `fixedAmount`, `hourlyRates` to GET_CASE query                          |
| `src/graphql/mutations.ts`                     | Modified | Added billing fields to UPDATE_CASE mutation return                                          |
| `src/components/cases/CaseCard.tsx`            | Modified | Added billing types to Case interface                                                        |
| `src/components/cases/CaseDetailPanel.tsx`     | Modified | Display real billing data from API                                                           |
| `src/hooks/mobile/useUpdateCase.ts`            | Modified | Added `hourlyRates` to backend input type and transformation                                 |
| `src/app/(dashboard)/cases/[id]/edit/page.tsx` | Modified | Added billing types to CaseData interface, initialize billing form fields from existing case |

## Task Completion Log

- [x] Task 1.1: Update GET_CASE Query - Added `billingType`, `fixedAmount`, `hourlyRates { partner, associate, paralegal }` to query
- [x] Task 1.2: Update UPDATE_CASE Mutation - Added billing fields to return selection
- [x] Task 2: Update CaseDetailPanel - Dynamic billing display with "Neconfigurat" fallback for null values
- [x] Task 3.1: Update Case TypeScript types - Added optional billing fields to Case interface
- [x] Task 3.2: Update useUpdateCase hook - Added hourlyRates to BackendUpdateCaseInput and transformation logic
- [x] Task 4: Verify Edit Page - Updated CaseData interface and useEffect to initialize billing fields from existing case data
- [x] Task 5: Loading states - Billing section gracefully handles null values with "-" and "Neconfigurat" text

## Issues Encountered

None - implementation went smoothly.

## Backend Requirements (Out of Scope)

For billing data to actually persist, `bojin-law-2` backend needs:

1. **Case Model**: Add fields `billing_type`, `fixed_amount`, `hourly_rates` (JSON)
2. **UpdateCaseInput**: Add `billingType`, `fixedAmount`, `hourlyRates` fields
3. **Resolvers**: Handle billing fields in update mutation
4. **Database Migration**: Add columns to cases table

Until backend is updated, billing fields will return `null` and display "Neconfigurat".

## Next Step

Run `/commit` to commit changes, or continue with more work.
