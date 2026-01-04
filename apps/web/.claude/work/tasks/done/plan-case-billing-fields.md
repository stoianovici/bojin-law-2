# Plan: Wire Case Billing & Classification Fields (Full Stack)

**Status**: Ready for Implementation
**Date**: 2026-01-02
**Input**: `iterate-cases-edit.md` + field analysis
**Next step**: `/implement plan-case-billing-fields`

---

## Context Summary

- **Frontend**: `bojin-law-ui` - Next.js 14 App Router with Apollo Client
- **Backend**: `bojin-law-2` - Rust GraphQL API (assumed separate repo)
- **Issue**: 7 case fields exist in frontend forms but are not persisted because backend doesn't support them

## Fields to Wire

| Field            | Frontend Location                       | Backend Status         |
| ---------------- | --------------------------------------- | ---------------------- |
| billingType      | Edit form, CaseDetailPanel              | Not in UpdateCaseInput |
| fixedAmount      | Edit form                               | Not in UpdateCaseInput |
| hourlyRates      | Edit form (partner/associate/paralegal) | Not implemented        |
| keywords         | New case form                           | Not in UpdateCaseInput |
| emailDomains     | New case form                           | Not in UpdateCaseInput |
| courtFileNumbers | New case form                           | Not in UpdateCaseInput |
| estimatedValue   | Forms                                   | Not implemented        |

## Approach Summary

This is a **frontend-only plan** for `bojin-law-ui`. Backend changes in `bojin-law-2` must be implemented separately. This plan:

1. Updates GraphQL queries/mutations to request billing fields (ready for when backend supports them)
2. Makes CaseDetailPanel display real billing data from API response
3. Ensures edit page form sends all billing fields in mutation

---

## Parallel Group 1: GraphQL Layer Updates

### Task 1.1: Update GET_CASE Query

- **File**: `src/graphql/queries.ts` (MODIFY)
- **Do**:
  1. Uncomment/add billing fields to GET_CASE query (lines ~107-113):
     ```graphql
     billingType
     fixedAmount
     hourlyRates {
       partner
       associate
       paralegal
     }
     ```
  2. Add fields to GET_CASES query if needed for list display
- **Done when**: GET_CASE query requests billing fields (will return null until backend implements)

### Task 1.2: Update UPDATE_CASE Mutation Return Fields

- **File**: `src/graphql/mutations.ts` (MODIFY)
- **Do**:
  1. Add billing fields to UPDATE_CASE mutation return selection:
     ```graphql
     billingType
     fixedAmount
     hourlyRates {
       partner
       associate
       paralegal
     }
     ```
- **Done when**: UPDATE_CASE mutation returns billing fields after save

---

## Sequential: After Group 1

### Task 2: Update CaseDetailPanel to Display Real Billing Data

- **Depends on**: Task 1.1
- **File**: `src/components/cases/CaseDetailPanel.tsx` (MODIFY)
- **Do**:
  1. Accept billing fields from case prop (type update if needed)
  2. Replace hardcoded billing display (lines ~145-159) with dynamic values:

     ```tsx
     // Current (hardcoded):
     <span>Orar</span>
     <span>250 EUR/h</span>

     // Change to:
     <span>{case.billingType === 'Fixed' ? 'Fix' : 'Orar'}</span>
     <span>
       {case.billingType === 'Fixed'
         ? `${case.fixedAmount} EUR`
         : `${case.hourlyRates?.partner || '-'} EUR/h`}
     </span>
     ```

  3. Show fallback text when billing data is null (pending backend)

- **Done when**: CaseDetailPanel displays billing data from API, or "Neconfigurat" when null

---

## Parallel Group 2: Type Safety Updates

### Task 3.1: Update Case TypeScript Types

- **File**: `src/types/case.ts` or relevant type file (MODIFY)
- **Do**:
  1. Add billing fields to Case interface:
     ```typescript
     billingType?: 'Hourly' | 'Fixed';
     fixedAmount?: number;
     hourlyRates?: {
       partner?: number;
       associate?: number;
       paralegal?: number;
     };
     ```
- **Done when**: TypeScript types include billing fields as optional

### Task 3.2: Update useUpdateCase Hook Input Type

- **File**: `src/hooks/mobile/useUpdateCase.ts` (MODIFY)
- **Do**:
  1. Verify BackendUpdateCaseInput includes all billing fields
  2. Ensure transformation logic handles hourlyRates object:
     ```typescript
     if (input.hourlyRates !== undefined) {
       backendInput.hourlyRates = input.hourlyRates;
     }
     ```
- **Done when**: Hook can send all billing fields to backend

---

## Final Steps (Sequential)

### Task 4: Verify Edit Page Form Sends Billing Fields

- **Depends on**: Tasks 3.1, 3.2
- **File**: `src/app/(dashboard)/cases/[id]/edit/page.tsx` (VERIFY/MODIFY)
- **Do**:
  1. Verify billing form fields are wired to state
  2. Verify handleSubmit includes billing fields in mutation input
  3. Test full flow: load case → edit billing → save → verify display
- **Done when**: Billing changes persist through edit flow (once backend supports)

### Task 5: Add Loading States for Billing Section

- **File**: `src/components/cases/CaseDetailPanel.tsx` (MODIFY)
- **Do**:
  1. Show skeleton/placeholder while billing data loads
  2. Show "Neconfigurat" or similar when billingType is null
- **Done when**: Billing section gracefully handles null/loading states

---

## Session Scope Assessment

- **Total tasks**: 6
- **Estimated complexity**: Medium
- **Dependencies**: Backend must implement billing fields for full functionality
- **Checkpoint recommended at**: After Task 2 (display layer complete)

## Backend Requirements (Out of Scope)

For this plan to fully work, `bojin-law-2` backend needs:

1. **Case Model**: Add fields `billing_type`, `fixed_amount`, `hourly_rates` (JSON)
2. **UpdateCaseInput**: Add `billingType`, `fixedAmount`, `hourlyRates` fields
3. **CreateCaseInput**: Add same billing fields
4. **Resolvers**: Handle billing fields in create/update mutations
5. **Database Migration**: Add columns to cases table

---

## Next Step

Start a new session and run:

```
/implement plan-case-billing-fields
```

Or implement backend changes first in `bojin-law-2`, then run this plan.
