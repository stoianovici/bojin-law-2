# Plan: Case Data Persistence Fix

**Status**: Approved
**Date**: 2026-01-03
**Input**: `research-iterate-case-data-persistence.md`
**Next step**: `/implement plan-iterate-case-data-persistence`

---

## Problem Statement

Users report that details set in new case or edit case don't persist - specifically billing/hourly rates don't save.

## Decisions (from research)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.

### Issues to Fix (Frontend-Only)

| Issue                                        | Location       | Root Cause                                                                                      |
| -------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| Custom hourly rates not visible after create | `mutations.ts` | CREATE_CASE mutation doesn't return `customRates` in response, so UI doesn't reflect saved data |

### Out of Scope

| Issue                                                | Why Out of Scope                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Client contact information (administrators/contacts) | Requires backend schema changes + new GraphQL fields                         |
| Team member assignment on create                     | Requires adding `teamMembers` to CreateCaseInput GraphQL schema              |
| Email classification fields                          | Keywords, emailDomains, courtFileNumbers collected but not in GraphQL schema |

---

## Implementation Approach

Add the missing billing-related fields (`billingType`, `fixedAmount`, `customRates`) to the CREATE_CASE mutation response. This mirrors the UPDATE_CASE mutation which already returns these fields and works correctly.

---

## Tasks

### Task 1: Add Billing Fields to CREATE_CASE Response

- **Implements**: Custom hourly rates visibility after create
- **File**: `apps/web/src/graphql/mutations.ts` (MODIFY)
- **Do**: Add `billingType`, `fixedAmount`, and `customRates { partnerRate associateRate paralegalRate }` to the CREATE_CASE mutation response (lines 8-33)
- **Done when**: CREATE_CASE mutation returns billing fields

---

### Sequential: After Task 1

### Task 2: Regenerate TypeScript Types

- **Implements**: Type safety for new response fields
- **Depends on**: Task 1
- **Do**: Run `pnpm codegen` to regenerate GraphQL types
- **Done when**: Types regenerated without errors

---

### Final: Verification

### Task 3: Verify Fix End-to-End

- **Depends on**: Task 1, Task 2
- **Do**:
  1. Create a new case with custom hourly rates
  2. Verify rates appear immediately after creation
  3. Edit the case and verify rates are pre-populated
- **Done when**: Rates persist and display correctly

---

## Decision Coverage Check

| Decision                                 | Implemented by Task(s) |
| ---------------------------------------- | ---------------------- |
| Custom hourly rates visible after create | Task 1, Task 2, Task 3 |

## Session Scope

- **Total tasks**: 3
- **Complexity**: Simple (single file change + verification)
