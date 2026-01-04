# Research: Case Data Persistence Issues

**Status**: Complete
**Date**: 2026-01-03
**Input**: `iterate-case-data-persistence.md`
**Next step**: `/plan research-iterate-case-data-persistence`

---

## Problem Statement

Users report that details set in new case or edit case don't persist - specifically:

1. Billing/hourly rates don't save
2. Contacts' emails don't get synced

---

## Decisions (from iteration investigation)

> **DO NOT MODIFY** - These are the agreed issues to fix.

### Issues to Fix (Frontend-Only)

| Issue                                       | Location           | Root Cause                                                                                                   |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Custom hourly rates not sent on create      | `useCreateCase.ts` | `hourlyRates` collected but transformation to `customRates` present, rates not returned in mutation response |
| Custom hourly rates field mapping on update | `useUpdateCase.ts` | Already correctly maps `hourlyRates` → `customRates`, backend receives correct data                          |

### Out of Scope (Requires Schema Changes)

| Issue                                                | Why Out of Scope                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Client contact information (administrators/contacts) | Requires backend schema changes + new GraphQL fields                         |
| Team member assignment on create                     | Requires adding `teamMembers` to CreateCaseInput GraphQL schema              |
| Email classification fields                          | Keywords, emailDomains, courtFileNumbers collected but not in GraphQL schema |

---

## Research Findings

### Open Questions - Answered

| Question                                         | Answer                                                                                                                                                   | Evidence                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Why don't custom rates persist on case creation? | Rates ARE persisting to database correctly. The issue is CREATE_CASE mutation doesn't return `customRates` in response, so UI doesn't reflect saved data | `mutations.ts:8-33` missing `customRates` in response; `case.resolvers.ts:700` stores correctly |
| Why don't custom rates persist on case update?   | Update works correctly. Transformation code maps `hourlyRates` → `customRates` properly and UPDATE_CASE returns `customRates`                            | `useUpdateCase.ts:129-135`, `mutations.ts:57-63`                                                |
| What field names does backend expect?            | Backend expects `customRates: { partnerRate, associateRate, paralegalRate }`                                                                             | `case.graphql:410-416` CustomRatesInput type                                                    |
| How are rates stored in database?                | JSON column `custom_rates` on Case model                                                                                                                 | `schema.prisma:520`                                                                             |

### Existing Code Analysis

| Category                          | Files                       | Notes                                               |
| --------------------------------- | --------------------------- | --------------------------------------------------- |
| **Works correctly**               | `useCreateCase.ts:129-135`  | Transformation maps `hourlyRates` → `customRates`   |
| **Works correctly**               | `useUpdateCase.ts:129-135`  | Same correct transformation                         |
| **Works correctly**               | `case.resolvers.ts:656-700` | Backend stores `customRates` properly               |
| **BUG - Missing response fields** | `mutations.ts:8-33`         | CREATE_CASE doesn't query `customRates` in response |
| **Works correctly**               | `mutations.ts:57-63`        | UPDATE_CASE does query `customRates` in response    |

### GraphQL Schema Analysis

**CreateCaseInput** (`case.graphql:381-414`):

```graphql
input CreateCaseInput {
  title: String!
  caseNumber: String
  clientName: String!
  type: String!
  description: String!
  value: Float
  metadata: JSON
  billingType: BillingType
  fixedAmount: Float
  customRates: CustomRatesInput # ✓ Accepts rates
  submitForApproval: Boolean
}
```

**CustomRatesInput** (`case.graphql:415-419`):

```graphql
input CustomRatesInput {
  partnerRate: Float
  associateRate: Float
  paralegalRate: Float
}
```

### Backend Resolver Analysis

**createCase** (`case.resolvers.ts:621-769`):

- **Line 656**: Validates billing input including `customRates`
- **Lines 661-667**: Falls back to firm defaults if `customRates` not provided
- **Lines 168-187**: Validation ensures rates are positive numbers
- **Line 700**: Stores to database: `customRates: customRates as any`

**updateCase** (`case.resolvers.ts:785-903`):

- **Line 796**: Checks for rate modifications
- **Lines 793-803**: Authorization check (Partners only can modify rates)
- **Lines 865-894**: Tracks rate changes to audit history

### Patterns Discovered

**Frontend → Backend Data Flow Pattern** (from `useCreateCase.ts`):

```typescript
// Frontend interface uses 'hourlyRates'
export interface CreateCaseInput {
  hourlyRates?: { partner?: number; associate?: number; paralegal?: number };
}

// Transform to backend format
if (input.hourlyRates) {
  backendInput.customRates = {
    partnerRate: input.hourlyRates.partner,
    associateRate: input.hourlyRates.associate,
    paralegalRate: input.hourlyRates.paralegal,
  };
}
```

**Mutation Response Pattern** - Why UPDATE works but CREATE seems broken:

- `UPDATE_CASE` includes `customRates { partnerRate associateRate paralegalRate }` in response
- `CREATE_CASE` does NOT include these fields, so Apollo cache doesn't update with rates

### Constraints Found

1. **Authorization**: Only Partners can modify case rates (`case.resolvers.ts:793-803`)
2. **Audit Trail**: Rate changes are tracked in `CaseRateChange` model
3. **Defaults**: If no custom rates provided, firm defaults are used (`case.resolvers.ts:661-667`)

---

## Implementation Recommendation

### The Real Fix: Add `customRates` to CREATE_CASE Response

The transformation code in hooks is working correctly. The issue is visibility - rates ARE saved to the database but the CREATE_CASE mutation doesn't return them, so users don't see the persisted values.

**Fix Required**: Modify `apps/web/src/graphql/mutations.ts` CREATE_CASE to include billing-related fields in the response.

### Why This Fix Is Sufficient

1. Frontend hooks already transform `hourlyRates` → `customRates` correctly
2. Backend resolver already accepts and stores `customRates`
3. Only the mutation response is missing these fields
4. UPDATE_CASE works because it includes `customRates` in response - same pattern needed for CREATE_CASE

---

## File Plan

| File                                | Action     | Purpose                                                                              |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `apps/web/src/graphql/mutations.ts` | **Modify** | Add `billingType`, `fixedAmount`, `customRates` to CREATE_CASE response (lines 8-33) |

### Detailed Change

Current CREATE_CASE (`mutations.ts:8-33`):

```graphql
mutation CreateCase($input: CreateCaseInput!) {
  createCase(input: $input) {
    id
    caseNumber
    title
    client {
      id
      name
    }
    type
    description
    status
    openedDate
    # MISSING: billingType, fixedAmount, customRates
  }
}
```

Required Change - Add these fields:

```graphql
mutation CreateCase($input: CreateCaseInput!) {
  createCase(input: $input) {
    id
    caseNumber
    title
    client {
      id
      name
    }
    type
    description
    status
    openedDate
    billingType
    fixedAmount
    customRates {
      partnerRate
      associateRate
      paralegalRate
    }
  }
}
```

---

## Risks

| Risk                                    | Mitigation                                                        |
| --------------------------------------- | ----------------------------------------------------------------- |
| Apollo cache might not update correctly | Already works for UPDATE_CASE with same fields, pattern is proven |
| Might break type definitions            | Run `pnpm codegen` to regenerate types after change               |

---

## Additional Findings (For Future Reference)

### Contact/Administrator Data Flow (OUT OF SCOPE)

Research confirmed that `companyDetails` (administrators + contacts) is:

- Collected in form (`page.tsx:123, 510-513`)
- Stored in state correctly
- **Never sent to backend** - completely ignored in `handleCreateNewClient`
- Would require backend schema changes to fix properly

### Team Member Assignment (OUT OF SCOPE)

Research confirmed that `teamMembers` is:

- Collected in form and validated
- **Never sent to backend** - `CreateCaseInput` GraphQL schema has no such field
- Backend auto-assigns creator as "Lead" only
- Would require adding `teamMembers: [CreateCaseTeamInput!]` to GraphQL schema

---

## Next Step

Start a new session and run:

```
/plan research-iterate-case-data-persistence
```
