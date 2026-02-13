# Investigation: Email Sync Flow - Sorting Algorithm Application

**Slug**: email-sync-sorting
**Date**: 2026-01-11
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug email-sync-sorting` to implement fix

---

## Bug Summary

**Reported symptom**: When actors are added through Edit Case or Edit Client, emails may be added directly to the client inbox without applying the sorting algorithm to check if they should be assigned to specific cases.

**Expected behavior** (clarified by user):

1. The sorting algorithm should be applied **every time** a new email is added (to client or case)
2. `ClientInbox` is for manual triage, but **only** for emails that didn't get a confident assignment from the algorithm
3. Re-evaluation should **only** look at unassigned emails - emails already assigned to other cases should be left alone (assumed correct)

---

## Root Cause Analysis

### The Bug

**Root cause**: The `updateClient` flow bypasses the classification scoring algorithm entirely, routing emails directly to `ClientInbox` for multi-case clients without checking if the algorithm could confidently assign them.

**Location**: `services/gateway/src/graphql/resolvers/client.resolvers.ts:406-430`

### Current Behavior (INCORRECT)

```typescript
// client.resolvers.ts lines 406-430
} else if (activeCases.length > 1) {
  // Multi-case client - route to ClientInbox for manual triage
  const routeResult = await prisma.email.updateMany({
    where: {
      firmId: user.firmId,
      caseId: null,
      classificationState: { in: ['Pending', 'Uncertain'] },
      OR: emailConditions,
    },
    data: {
      clientId: args.id,
      classificationState: EmailClassificationState.ClientInbox,  // ← WRONG: Skips algorithm
      classifiedAt: new Date(),
      classifiedBy: 'client_contact_match',
    },
  });
}
```

### Expected Behavior (CORRECT)

For each matched email:

1. Run `classificationScoringService.classifyEmail()`
2. If algorithm returns confident assignment → assign to that case
3. If algorithm returns `Uncertain` or `ClientInbox` → route to ClientInbox for manual triage

---

## Two Issues Found

### Issue 1: `updateClient` Skips Sorting Algorithm

**File**: `client.resolvers.ts:406-430`

When a client with multiple cases has their email updated:

- Current: All matching emails go directly to `ClientInbox`
- Expected: Run scoring algorithm first, only uncertain emails go to `ClientInbox`

### Issue 2: OPS-043 Re-evaluates Already-Assigned Emails (Minor)

**File**: `case.resolvers.ts:1392-1491`

When an actor is added to a case, OPS-043 logic re-evaluates emails that are already classified in OTHER cases:

- Current: Re-evaluates and potentially moves to Uncertain
- Expected: Leave emails in other cases alone (assume correct)

**Note**: User says this should NOT happen - emails already assigned to cases should be left alone.

---

## Code Paths

### `updateClient` Flow (BROKEN)

```
User updates client email
  └─ Find Pending/Uncertain emails from contact
      └─ If single case: Auto-assign (OK)
      └─ If multi-case: Route ALL to ClientInbox (WRONG)
                        ↳ Should run algorithm first!
```

### `addCaseActor` Flow (PARTIALLY WRONG)

```
User adds actor to case
  └─ Find Pending/Uncertain emails: Auto-assign to case (OK)
  └─ OPS-043: Find emails in OTHER cases
      └─ Re-evaluate and move to Uncertain (WRONG per user)
      ↳ Should leave other case emails alone!
```

---

## Impact Assessment

**Affected functionality**:

- Email classification when client email is updated (multi-case clients)
- Thread continuity not checked for multi-case client emails
- Reference number matching not applied
- High-confidence signals ignored

**Blast radius**: Moderate - users must manually triage emails that could be auto-assigned

**User impact**: Extra manual work in ClientInbox

---

## Proposed Fix

### Fix 1: Apply Scoring Algorithm in `updateClient`

**File**: `services/gateway/src/graphql/resolvers/client.resolvers.ts`

**Change**: Replace the bulk `updateMany` to `ClientInbox` with:

1. Fetch matching emails individually
2. For each email, call `classificationScoringService.classifyEmail()`
3. If confident (`Classified` state with high confidence) → assign to recommended case
4. If uncertain (`Uncertain` or `ClientInbox`) → route to ClientInbox

```typescript
// Pseudocode for fix
const matchingEmails = await prisma.email.findMany({
  where: {
    /* same conditions */
  },
  select: {
    /* email fields for classification */
  },
});

for (const email of matchingEmails) {
  const result = await classificationScoringService.classifyEmail(emailForClassify, firmId, userId);

  if (result.state === 'Classified' && result.caseId) {
    // Confident assignment - assign to case
    await prisma.email.update({
      where: { id: email.id },
      data: {
        caseId: result.caseId,
        classificationState: 'Classified',
        classificationConfidence: result.confidence,
        classifiedBy: 'auto',
      },
    });
  } else {
    // Uncertain - route to ClientInbox
    await prisma.email.update({
      where: { id: email.id },
      data: {
        clientId: clientId,
        classificationState: 'ClientInbox',
        classifiedBy: 'client_contact_match',
      },
    });
  }
}
```

### Fix 2: Remove OPS-043 Re-evaluation of Other Cases' Emails

**File**: `services/gateway/src/graphql/resolvers/case.resolvers.ts`

**Change**: Remove or disable the OPS-043 block (lines 1392-1491) that re-evaluates emails already assigned to other cases.

**Rationale**: User confirmed emails in other cases should be assumed correct and left alone.

---

## Files to Change

| File                  | Change                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `client.resolvers.ts` | Lines 406-430: Apply scoring algorithm before routing to ClientInbox |
| `case.resolvers.ts`   | Lines 1392-1491: Remove OPS-043 re-evaluation of other cases' emails |

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Single-case client email update: emails auto-assign correctly
2. [ ] Multi-case client email update:
   - [ ] Algorithm runs for each matched email
   - [ ] Confident matches auto-assign to case
   - [ ] Uncertain emails route to ClientInbox
3. [ ] Thread continuity works for multi-case clients (same conversation → same case)
4. [ ] `addCaseActor` no longer re-evaluates emails in other cases
5. [ ] Performance acceptable (may need batching for many emails)

---

## Investigation Notes

### Files Examined

| File                          | Purpose              | Finding                                              |
| ----------------------------- | -------------------- | ---------------------------------------------------- |
| `client.resolvers.ts:361-432` | updateClient         | Bulk routes to ClientInbox without scoring           |
| `case.resolvers.ts:1392-1491` | addCaseActor OPS-043 | Re-evaluates other cases' emails (should be removed) |
| `classification-scoring.ts`   | Scoring algorithm    | Full algorithm exists, just not called               |

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-sync-sorting
```

The fix involves:

1. Applying the scoring algorithm in `updateClient` before routing to `ClientInbox`
2. Removing the OPS-043 re-evaluation logic that touches other cases' emails
