# Investigation: Single-Case Client Reclassification Assigns All Emails Blindly

**Slug**: client-email-reclassification
**Date**: 2026-01-15
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug client-email-reclassification` to implement fix

---

## Bug Summary

**Reported symptom**: After editing client details, all emails matching the client's email were assigned to their single case, including emails that don't belong to that case.

**Reproduction steps**:

1. Have a client with exactly 1 active case
2. Edit the client's email address (or add a new contact email)
3. Observe that ALL matching emails are auto-assigned to that case

**Expected behavior**: Emails should be evaluated individually using the classification algorithm. Only emails that actually belong to the case (via thread continuity, reference match, or high-confidence contact match) should be assigned. Others should go to ClientInbox for manual review.

**Actual behavior**: ALL emails matching the client's email address are blindly assigned to the single case with 0.95 confidence, bypassing the classification algorithm entirely.

**Frequency**: Always (when client has exactly 1 active case)

---

## Root Cause Analysis

### The Bug

**Root cause**: The single-case path in `updateClient` bypasses the email classification algorithm and blindly assigns all matching emails to the case.

**Location**: `services/gateway/src/graphql/resolvers/client.resolvers.ts:442-522`

**Code path**:

```
updateClient mutation
  → emailChanged check (line 427)
  → activeCases.length === 1 branch (line 442)
  → Bulk assign ALL matching emails (lines 475-485)
```

**Type**: Logic error

### Why It Happens

The code assumes: "If a client has only 1 active case, then all emails from their contacts must belong to that case."

This assumption is flawed because:

1. **Historical emails**: Emails from before the case was created don't belong to it
2. **Personal emails**: Client may send personal/unrelated emails
3. **Untracked matters**: Client may have other legal matters not yet tracked as cases
4. **Classification signals ignored**: Thread continuity, reference numbers, and other signals are completely bypassed

**Single-case path** (lines 442-522):

```typescript
if (activeCases.length === 1) {
  // Finds ALL matching emails
  const emailsToAssign = await prisma.email.findMany({...});

  // BLINDLY assigns ALL of them - NO classification check
  await prisma.email.updateMany({
    where: { id: { in: emailsToAssign.map((e) => e.id) } },
    data: {
      caseId: targetCaseId,  // All go to the same case
      classificationState: EmailClassificationState.Classified,
      classificationConfidence: 0.95,  // False confidence
    },
  });
}
```

**Multi-case path** (lines 523-670) - the correct approach:

```typescript
} else if (activeCases.length > 1) {
  for (const email of matchingEmails) {
    // RUNS CLASSIFICATION for each email
    const result = await emailClassifierService.classifyEmail(email, ...);

    if (result.state === EmailClassificationState.Classified && result.caseId) {
      // Only assign if classifier is confident
    } else {
      // Route to ClientInbox for manual review
    }
  }
}
```

### Why It Wasn't Caught

1. **Optimization mindset**: The single-case shortcut was likely added as an "optimization" - "why run classification if there's only one choice?"
2. **Missing test coverage**: No tests verify that single-case clients still go through proper classification
3. **False assumption**: Assumed sender identity = case membership, which ignores thread context and historical emails

---

## Impact Assessment

**Affected functionality**:

- Client email reclassification on edit
- Single-case client email routing
- Email classification accuracy for single-case clients

**Blast radius**: Moderate - affects all single-case clients when their contact info is updated

**Related code**:

- `services/gateway/src/services/email-classifier.ts`: The classifier that SHOULD be used
- `services/gateway/src/services/contact-matcher.ts`: Contact matching logic
- `services/gateway/src/graphql/resolvers/case.resolvers.ts`: Similar patterns may exist

**Risk of similar bugs**: Medium - The same flawed assumption (single case = all emails belong there) might exist elsewhere

---

## Proposed Fix Approaches

### Option A: Unify Single-Case and Multi-Case Paths

**Approach**: Remove the single-case shortcut entirely. Always run the classification algorithm, regardless of how many cases the client has.

**Files to change**:

- `services/gateway/src/graphql/resolvers/client.resolvers.ts`: Remove lines 442-522, use the multi-case logic for all cases

**Pros**:

- Simplest fix
- Consistent behavior regardless of case count
- Proper classification for all emails

**Cons**:

- Slightly slower for single-case clients (runs classifier per email instead of batch)

**Risk**: Low

### Option B: Run Classifier in Single-Case Path

**Approach**: Keep the single-case branch but add classification checks before assignment.

**Files to change**:

- `services/gateway/src/graphql/resolvers/client.resolvers.ts`: Add classifier call inside single-case loop

**Pros**:

- Preserves the distinction between paths (may be useful for future optimization)

**Cons**:

- More code to maintain
- Two paths doing similar things

**Risk**: Low

### Option C: Route Single-Case Emails to ClientInbox

**Approach**: For single-case clients, route emails to ClientInbox instead of auto-assigning. Let user manually confirm.

**Files to change**:

- `services/gateway/src/graphql/resolvers/client.resolvers.ts`: Change single-case assignment to ClientInbox

**Pros**:

- Most conservative - requires human review
- Prevents any false positives

**Cons**:

- Adds friction for users
- Single-case clients don't benefit from auto-classification

**Risk**: Low (but worse UX)

### Recommendation

**Option A** - Remove the single-case shortcut and use the same classification logic for all clients.

The single-case "optimization" causes incorrect behavior and the performance difference is negligible. The classifier runs per-email anyway for multi-case clients, and most firms have a manageable volume of emails to reclassify on client edit.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Single-case client edit triggers classification algorithm per email
2. [ ] Emails with thread continuity to the case are still classified correctly
3. [ ] Emails without case association go to ClientInbox, not the case
4. [ ] Multi-case client behavior unchanged
5. [ ] Historical emails (before case creation) don't auto-assign to case

### Suggested Test Cases

```typescript
// client.resolvers.test.ts
describe('updateClient email reclassification', () => {
  it('should run classification for single-case client emails', async () => {
    // Setup: Client with 1 case, pending email from client
    // Action: Update client email
    // Assert: Email goes through classifier, not bulk-assigned
  });

  it('should route unrelated emails to ClientInbox for single-case clients', async () => {
    // Setup: Client with 1 case, email from client about unrelated matter
    // Action: Update client email
    // Assert: Email lands in ClientInbox, not the case
  });

  it('should assign thread-continuous emails to case for single-case clients', async () => {
    // Setup: Client with 1 case, email that continues existing case thread
    // Action: Update client email
    // Assert: Email assigned to case via thread continuity
  });
});
```

---

## Investigation Notes

### Files Examined

| File                    | Purpose                                 | Relevant Finding                                        |
| ----------------------- | --------------------------------------- | ------------------------------------------------------- |
| `client.resolvers.ts`   | Client CRUD + reclassification triggers | Contains the bug - single-case path bypasses classifier |
| `email-classifier.ts`   | Classification pipeline                 | Works correctly, but isn't called in single-case path   |
| `email-reclassifier.ts` | Reclassification triggers               | Uses classifier correctly for other triggers            |
| `contact-matcher.ts`    | Contact → client/case mapping           | Not the issue - correctly returns certainty levels      |

### Git History

Recent commit `a909516` refactored email classification with modular architecture. The single-case shortcut may have been introduced or preserved during this refactor.

### Questions Answered During Investigation

- Q: Why did all emails go to the case?
- A: The single-case path (lines 442-522) blindly assigns all matching emails without running the classification algorithm.

- Q: Why is this different from multi-case clients?
- A: Multi-case clients go through the classifier per-email (lines 566-587), which properly evaluates each email.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug client-email-reclassification
```

The debug phase will:

1. Read this investigation document
2. Implement Option A (unify paths)
3. Add test coverage
4. Verify the fix
