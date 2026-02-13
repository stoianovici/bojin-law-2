# Investigation: Emails Not Re-scanned When Contact Added to Client or Case

**Slug**: email-client-rescan
**Date**: 2026-01-11
**Status**: Investigation Complete
**Severity**: Medium
**Scope**: Re-scan emails after any contact info is added at client OR case level
**Next step**: `/debug email-client-rescan` to implement fix

---

## Bug Summary

**Reported symptom**: After saving an email address to an existing client and clicking "Sync" in /email, no emails appeared for that client despite known correspondence existing.

**Reproduction steps**:

1. Have emails already synced (some may be in "Neclasificate"/Uncertain state)
2. Add/update an email address on an existing client
3. Click "Sync" in /email
4. Expected: Emails from that address should now be linked to the client/cases
5. Actual: No new associations are made

**Expected behavior**: When a new email address is added to a client (or case actor), the system should scan already-synced emails (especially those in Uncertain/NECLAR state) and re-classify them based on the new contact information.

**Actual behavior**:

- **Case-level (CaseActor)**: ✅ Works - `addCaseActor` and `updateCaseActor` already auto-assign Pending/Uncertain emails
- **Client-level**: ❌ Broken - `updateClient` does NOT trigger any email re-classification

**Frequency**: Always for client-level updates (by design - no re-classification logic exists)

---

## Root Cause Analysis

### The Bug

**Root cause**: The `updateClient` mutation saves the email but does NOT trigger re-classification of existing emails, unlike `addCaseActor`/`updateCaseActor` which already have this logic.

**Location**:

- `services/gateway/src/graphql/resolvers/client.resolvers.ts:265-388` (updateClient - **MISSING** re-classification)
- `services/gateway/src/graphql/resolvers/case.resolvers.ts:1297-1534` (addCaseActor - **HAS** re-classification)
- `services/gateway/src/graphql/resolvers/case.resolvers.ts:1537-1656` (updateCaseActor - **HAS** re-classification)

**Type**: Inconsistent implementation - case-level has the feature, client-level doesn't

### What Already Works (Case-Level)

`addCaseActor` (lines 1367-1388) already does email re-classification:

```typescript
// Find and assign matching emails that are Pending or Uncertain
const assignResult = await prisma.email.updateMany({
  where: {
    firmId: user.firmId,
    caseId: null, // Only unassigned emails
    classificationState: {
      in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
    },
    OR: emailConditions, // Match by email or domain
  },
  data: {
    caseId: args.input.caseId,
    classificationState: EmailClassificationState.Classified,
    classificationConfidence: 0.95,
    classifiedAt: new Date(),
    classifiedBy: 'contact_match',
  },
});
```

`updateCaseActor` (lines 1623-1639) has the same logic when email changes.

### What's Missing (Client-Level)

`updateClient` (lines 265-388):

- Saves `contactInfo.email` ✅
- Invalidates AI context cache ✅
- **Does NOT** search for matching emails ❌
- **Does NOT** trigger re-classification ❌

### Why Client-Level is More Complex

When a CaseActor email is added, we know exactly which case to assign emails to.

When a Client email is added, the client may have **multiple active cases**. The system needs to:

1. Find all cases for this client
2. For each matching email, determine which case(s) it belongs to
3. Either auto-assign (single case) or route to ClientInbox (multi-case)

The `findCasesForContact()` in `classification-scoring.ts` already handles this - it looks for:

- `CaseActor.email` matching the sender
- `Client.contactInfo.email` matching the sender

So the classification infrastructure exists - it just needs to be triggered from `updateClient`.

---

## Impact Assessment

**Affected functionality**:

- Client email updates not reflecting in email associations
- Emails from known clients remaining in NECLAR despite being classifiable

**Blast radius**: Moderate - affects any user who adds/updates client email after emails are synced

**What works correctly**:

- Adding CaseActor with email → emails auto-assigned ✅
- Updating CaseActor email → emails auto-assigned ✅
- New emails synced after client email set → correctly classified ✅

**What's broken**:

- Updating Client email → existing emails NOT re-classified ❌

---

## Proposed Fix

### Approach: Add Re-classification to updateClient

Mirror the logic from `addCaseActor`/`updateCaseActor` but with client-aware handling.

**Files to change**:

- `services/gateway/src/graphql/resolvers/client.resolvers.ts`: Add re-classification after email update

**Implementation**:

```typescript
// After updating client, if email changed:
if (emailChanged) {
  const newEmail = args.input.email?.toLowerCase();

  // Find client's cases
  const clientCases = await prisma.case.findMany({
    where: { clientId: args.id, status: { in: ['Active', 'PendingApproval'] } },
    select: { id: true },
  });

  if (clientCases.length === 1) {
    // Single case - auto-assign emails directly
    await prisma.email.updateMany({
      where: {
        firmId: user.firmId,
        caseId: null,
        classificationState: { in: ['Pending', 'Uncertain'] },
        from: { path: ['address'], string_contains: newEmail },
      },
      data: {
        caseId: clientCases[0].id,
        classificationState: 'Classified',
        classificationConfidence: 0.95,
        classifiedAt: new Date(),
        classifiedBy: 'client_contact_match',
      },
    });
  } else if (clientCases.length > 1) {
    // Multi-case client - route to ClientInbox for manual assignment
    await prisma.email.updateMany({
      where: {
        firmId: user.firmId,
        caseId: null,
        classificationState: { in: ['Pending', 'Uncertain'] },
        from: { path: ['address'], string_contains: newEmail },
      },
      data: {
        classificationState: 'ClientInbox',
        // clientId would need to be added if not already tracked
      },
    });
  }
  // If 0 cases, no action needed - emails stay in NECLAR
}
```

**Pros**:

- Consistent with CaseActor behavior
- Uses existing classification infrastructure
- Handles multi-case clients correctly

**Cons**:

- Slightly more complex than CaseActor due to multi-case handling
- May need to add `clientId` to Email model if not already there for ClientInbox routing

**Risk**: Low

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] **Single-case client**: Updating client email auto-assigns matching Uncertain emails to the case
2. [ ] **Multi-case client**: Updating client email routes matching emails to ClientInbox (not auto-assigned)
3. [ ] **No cases client**: Updating email doesn't break anything (emails stay in NECLAR)
4. [ ] **Case actor still works**: Adding/updating CaseActor continues to work as before
5. [ ] **Already classified emails**: NOT affected (avoid duplicate assignments)
6. [ ] **Sent emails**: Also re-classified based on recipients (not just received emails)

### Suggested Test Cases

```typescript
// client.resolvers.test.ts
describe('updateClient email re-classification', () => {
  it('should auto-assign uncertain emails for single-case client', async () => {
    // Setup: Client with 1 case, uncertain emails from contact@example.com
    // Action: Update client email to contact@example.com
    // Assert: Emails now classified and linked to the case
  });

  it('should route to ClientInbox for multi-case client', async () => {
    // Setup: Client with 2+ cases, uncertain emails from contact@example.com
    // Action: Update client email to contact@example.com
    // Assert: Emails moved to ClientInbox state for manual triage
  });

  it('should not affect already classified emails', async () => {
    // Setup: Email already classified to a specific case
    // Action: Update client email to match that email's sender
    // Assert: Email stays in original case, not moved
  });
});
```

---

## Investigation Notes

### Files Examined

| File                             | Purpose                   | Relevant Finding                                          |
| -------------------------------- | ------------------------- | --------------------------------------------------------- |
| `client.resolvers.ts`            | Client CRUD               | `updateClient` missing re-classification logic            |
| `case.resolvers.ts`              | Case/Actor CRUD           | `addCaseActor` & `updateCaseActor` HAVE re-classification |
| `classification-scoring.ts`      | Email→case matching       | `findCasesForContact()` already supports client email     |
| `email-categorization.worker.ts` | Background classification | Only processes `Pending` emails                           |

### Key Code References

1. **CaseActor email assignment (WORKS)**:
   `services/gateway/src/graphql/resolvers/case.resolvers.ts:1367-1388`

2. **Client update (MISSING re-classification)**:
   `services/gateway/src/graphql/resolvers/client.resolvers.ts:357-358`

   ```typescript
   // Only invalidates cache, no email re-scan
   caseContextService.invalidateClientContext(args.id).catch(() => {});
   ```

3. **Classification scoring supports client email**:
   `services/gateway/src/services/classification-scoring.ts:729-741`

---

## Summary

| Contact Type | Add                     | Update                  | Status         |
| ------------ | ----------------------- | ----------------------- | -------------- |
| CaseActor    | ✅ Re-classifies emails | ✅ Re-classifies emails | Working        |
| Client       | N/A (createClient)      | ❌ No re-classification | **FIX NEEDED** |

The fix is to add the same re-classification logic to `updateClient` that already exists in `addCaseActor`/`updateCaseActor`, with additional handling for multi-case clients.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-client-rescan
```

The debug phase will:

1. Read this investigation document
2. Add re-classification logic to `updateClient`
3. Handle single-case vs multi-case clients appropriately
4. Verify the fix works without breaking existing CaseActor functionality
