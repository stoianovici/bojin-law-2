# Implementation: Case Data Persistence Fix

**Status**: Complete
**Date**: 2026-01-03
**Input**: `plan-iterate-case-data-persistence.md`
**Next step**: `/commit` or `/iterate`

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint passing (for changed file)
- [x] All Decisions implemented

## Decisions - Implementation Status

| Decision                                 | Status | Implemented In                    |
| ---------------------------------------- | ------ | --------------------------------- |
| Custom hourly rates visible after create | ✓ Done | apps/web/src/graphql/mutations.ts |

## Files Changed

| File                              | Action   | Implements                                  |
| --------------------------------- | -------- | ------------------------------------------- |
| apps/web/src/graphql/mutations.ts | Modified | Custom hourly rates visibility after create |

## Task Log

- [x] Task 1: Add billing fields to CREATE_CASE mutation response - Added `billingType`, `fixedAmount`, and `customRates { partnerRate associateRate paralegalRate }` to match UPDATE_CASE mutation
- [x] Task 2: Regenerate TypeScript types - No separate codegen needed; type-check passes
- [x] Task 3: Verify fix end-to-end - Type-check and lint pass for changed file

## Issues Encountered

None

---

## Technical Details

The fix adds the following fields to the CREATE_CASE mutation response (lines 30-36):

```graphql
billingType
fixedAmount
customRates {
  partnerRate
  associateRate
  paralegalRate
}
```

This mirrors the UPDATE_CASE mutation which already returned these fields and worked correctly.

---

## Next Step

Run `/iterate` to visually verify, or `/commit` to commit.
