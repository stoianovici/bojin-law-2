# Investigation: Case Edit Form Data Persistence

**Slug**: case-edit-save
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug case-edit-save` to implement fix

---

## Bug Summary

**Reported symptom**: Preventive check requested after other case detail buttons needed deep fixes - verifying if editing a case properly saves all input for both client and case data.

**Reproduction steps**:

1. Navigate to a case and click "Edit" to go to `/cases/[id]/edit`
2. Modify billing-related fields (hourly rates for partner/associate/paralegal)
3. Save the form
4. Re-open the edit page

**Expected behavior**: All fields should persist correctly, including hourly rates.

**Actual behavior**: **Hourly rates do NOT load on page reload** - the data IS saved to the backend but the frontend fails to load it back because of a field name mismatch.

**Frequency**: Always (data loss on display, not on save)

---

## Root Cause Analysis

### Bug #1: Field Name Mismatch Between Query and Component

**Root cause**: The edit page expects `hourlyRates` from the GraphQL response, but the backend returns `customRates`.

**Location**: `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx:69-77` and `:211-220`

**Code path**:

```
GET_CASE query → returns { customRates: { partnerRate, associateRate, paralegalRate } }
                         ↓
Edit page TypeScript interface → expects { hourlyRates: { partner, associate, paralegal } }
                         ↓
useEffect initialization → tries to read existingCase.hourlyRates (undefined!)
                         ↓
Rates appear empty in form
```

**Type**: Data bug - field name mismatch between query response and component expectations

### Why It Happens

The edit page defines its own interface `CaseData` at line 43-77 with:

```typescript
hourlyRates?: {
  partner?: number;
  associate?: number;
  paralegal?: number;
};
```

But the `GET_CASE` GraphQL query (queries.ts:78-127) returns:

```graphql
customRates {
  partnerRate
  associateRate
  paralegalRate
}
```

The initialization effect at lines 211-220 tries to read `existingCase.hourlyRates` which is always `undefined` because the API returns `customRates` with different nested field names (`partnerRate` vs `partner`).

### Why It Wasn't Caught

1. **No TypeScript error**: The interface is defined locally in the component, not generated from the GraphQL schema
2. **No runtime error**: Reading `undefined` properties just results in empty form fields
3. **Save works**: The save flow has its own transformation that correctly sends `customRates` to the backend
4. **Silent failure**: The form loads without errors, just with empty rate fields

---

## Additional Issues Found

### Bug #2: Several Fields Not Sent to Backend on Update

**Location**: `apps/web/src/hooks/mobile/useUpdateCase.ts:86-98`

The `BackendUpdateCaseInput` interface and transformation logic is **missing several fields** that the form collects:

| Field in Form          | Sent to Backend? | Backend Accepts?                  |
| ---------------------- | ---------------- | --------------------------------- |
| `title`                | Yes              | Yes                               |
| `type`                 | Yes              | Yes                               |
| `description`          | Yes              | Yes                               |
| `status`               | Yes              | Yes                               |
| `billingType`          | Yes              | Yes                               |
| `fixedAmount`          | Yes              | Yes                               |
| `customRates`          | Yes              | Yes                               |
| **`teamMembers`**      | **NO**           | **NO** (separate mutation)        |
| **`keywords`**         | **NO**           | via `updateCaseMetadata` mutation |
| **`emailDomains`**     | **NO**           | via `updateCaseMetadata` mutation |
| **`courtFileNumbers`** | **NO**           | via `updateCaseMetadata` mutation |
| **`estimatedValue`**   | **NO**           | **NO** (not in schema)            |

These fields are collected in the form but never sent to the backend!

### Bug #3: Team Members Not Updated

The edit page allows editing team members via `TeamMemberSelect`, but the `useUpdateCase` hook does NOT send `teamMembers` to the backend. Team member changes are silently discarded.

The `UpdateCaseInput` in the GraphQL schema (case.graphql:500-533) does NOT include `teamMembers` - these should be updated via separate `assignTeam` and `removeTeamMember` mutations.

### Bug #4: Email Classification Fields Not Sent

The form collects:

- `keywords`
- `emailDomains`
- `courtFileNumbers` (referenceNumbers)

But the `useUpdateCase` hook doesn't send these. They should be sent via the `updateCaseMetadata` mutation.

### Bug #5: Estimated Value Not Supported

The form has an `estimatedValue` field but:

- It's not in `BackendUpdateCaseInput`
- It's not in the GraphQL `UpdateCaseInput` schema
- The `Case` type has `value` but it's not in `UpdateCaseInput`

---

## Impact Assessment

**Affected functionality**:

- Case editing (hourly rates display)
- Team member editing (silently discarded)
- Email classification metadata (silently discarded)
- Estimated value (silently discarded)

**Blast radius**: Wide - affects all case editing

**Related code**:

- `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx`: Main form
- `apps/web/src/hooks/mobile/useUpdateCase.ts`: Update mutation hook
- `apps/web/src/graphql/queries.ts`: GET_CASE query
- `apps/web/src/graphql/mutations.ts`: UPDATE_CASE mutation

**Risk of similar bugs**: High - The pattern of local interfaces mismatching GraphQL types could exist elsewhere.

---

## Proposed Fix Approaches

### Option A: Fix Field Names in Edit Page (Minimal Change)

**Approach**: Update the edit page to correctly read `customRates` from the API response.

**Files to change**:

- `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx`:
  - Update `CaseData` interface to use `customRates` with `partnerRate/associateRate/paralegalRate`
  - Update initialization logic (lines 211-220) to read from `customRates`

**Pros**:

- Minimal change
- Fixes the immediate data loading issue

**Cons**:

- Does not address team members, keywords, or other missing fields
- Local interface still diverges from actual GraphQL types

### Option B: Comprehensive Fix (Recommended)

**Approach**: Fix field name mismatch AND implement missing field updates.

**Files to change**:

- `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx`:
  - Fix `CaseData` interface to match GraphQL response
  - Fix initialization to read `customRates` correctly
  - Add calls to `updateCaseMetadata` for keywords/emailDomains/referenceNumbers
  - Add proper team member update logic using `assignTeam`/`removeTeamMember`
  - Either implement `estimatedValue` backend support or remove the field

- `apps/web/src/hooks/mobile/useUpdateCase.ts`:
  - Add `estimatedValue` to `BackendUpdateCaseInput` if backend will be updated
  - OR keep as-is if metadata will be sent via separate mutation

- Potentially `services/gateway/src/graphql/schema/case.graphql`:
  - Add `value` to `UpdateCaseInput` if estimatedValue should be editable

**Pros**:

- Fixes all identified issues
- Form actually saves what it displays

**Cons**:

- More changes required
- Need to decide on metadata update strategy (single mutation vs multiple)

### Recommendation

**Option B** - The form currently gives users a false sense that their changes are saved. This is worse than having fewer fields editable. Fix the mismatch and either:

1. Remove fields that can't be saved, OR
2. Implement proper saving for all displayed fields

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - hourly rates load correctly after edit
2. [ ] Billing type toggle persists correctly
3. [ ] Fixed amount saves when billing type is "Fixed"
4. [ ] Custom rates save when billing type is "Hourly"
5. [ ] Title, type, description save correctly
6. [ ] Team member changes are saved (via separate mutations)
7. [ ] Keywords, email domains, court file numbers save (via updateCaseMetadata)
8. [ ] Either estimated value saves OR the field is removed

### Suggested Test Cases

```typescript
// cases/[id]/edit/page.test.tsx
describe('EditCasePage', () => {
  it('should load existing hourly rates from customRates field', () => {
    // Mock GET_CASE to return customRates: { partnerRate: 500, ... }
    // Verify form fields show 500 for partner rate
  });

  it('should save hourly rates correctly', () => {
    // Fill in rates, submit
    // Verify mutation called with customRates: { partnerRate, associateRate, paralegalRate }
  });

  it('should update team members via assignTeam/removeTeamMember mutations', () => {
    // Add team member, remove team member
    // Verify correct mutations called
  });

  it('should update keywords via updateCaseMetadata mutation', () => {
    // Add keywords
    // Verify updateCaseMetadata called
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                       | Purpose              | Relevant Finding                                                    |
| ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `apps/web/src/app/(dashboard)/cases/[id]/edit/page.tsx`    | Edit form UI         | Uses `hourlyRates` but API returns `customRates`                    |
| `apps/web/src/hooks/mobile/useUpdateCase.ts`               | Update mutation hook | Missing fields: teamMembers, keywords, emailDomains, estimatedValue |
| `apps/web/src/graphql/queries.ts`                          | GraphQL queries      | GET_CASE returns `customRates`, not `hourlyRates`                   |
| `apps/web/src/graphql/mutations.ts`                        | GraphQL mutations    | UPDATE_CASE exists, but missing fields                              |
| `services/gateway/src/graphql/schema/case.graphql`         | Backend schema       | `UpdateCaseInput` missing teamMembers, keywords, value              |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts` | Backend resolver     | Passes `args.input` directly to Prisma                              |

### Key Code Snippets

**Edit page expects `hourlyRates`** (line 69-76):

```typescript
interface CaseData {
  case: {
    // ...
    hourlyRates?: {
      partner?: number;
      associate?: number;
      paralegal?: number;
    };
  };
}
```

**GraphQL returns `customRates`** (queries.ts line 115-120):

```graphql
customRates {
  partnerRate
  associateRate
  paralegalRate
}
```

**Initialization reads wrong field** (line 211-220):

```typescript
if (existingCase.hourlyRates) {
  // Always undefined!
  if (existingCase.hourlyRates.partner) {
    setPartnerRate(existingCase.hourlyRates.partner.toString());
  }
  // ...
}
```

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug case-edit-save
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation
3. Get approval before making changes
4. Implement and verify the fix
