# Investigation: Client-Level Emails Not Displaying

**Slug**: client-inbox-missing
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug client-inbox-missing` to implement fix

---

## Bug Summary

**Reported symptom**: Classification of emails broke - it now doesn't display client-level emails anymore

**Reproduction steps**:

1. Navigate to http://localhost:3000/email
2. Look at the sidebar under DOSARE section
3. Expand "T.T. & CO Solaria Grup SRL" client (which has 2 active cases)
4. Observe that there is NO "Inbox Client" section showing client-level emails

**Expected behavior**: When a contact (e.g., `solariagrup@gmail.com`) has multiple active cases with the same client, emails from that contact should appear in the "Inbox Client" section for manual case assignment.

**Actual behavior**: All emails from multi-case contacts are being auto-classified to specific cases. The "Inbox Client" section never appears because no emails have `ClientInbox` classification state.

**Frequency**: Always - 0 emails have `ClientInbox` state in the database

---

## Root Cause Analysis

### The Bug

**Root cause**: The `ClientInbox` classification state is only set when there's NO clear scoring winner (gap < 20 points between top two cases). The current scoring algorithm almost always finds a clear winner because emails typically have strong signals (thread continuity, keywords, reference numbers) that favor one case over another.

**Location**: `services/gateway/src/services/classification-scoring.ts:469-486`

**Code path**:

```
Email arrives → classifyEmail() → findCasesForContact() returns 2 cases →
scoreCase() for each → Compare scores → If gap >= 20 → Classified (NOT ClientInbox)
```

**Type**: Logic error - the threshold for "no clear winner" (MIN_GAP = 20) is too strict, causing emails to bypass the ClientInbox routing even when the user might want to review the assignment.

### Why It Happens

The classification scoring algorithm works as follows (lines 452-512):

```typescript
// OPS-195: Check if sender has multiple cases (requires confirmation)
const needsConfirmation = candidateCases.length >= 2 && !hasThreadMatch;

if (needsConfirmation && candidateCases.length >= 2) {
  // Check if all candidate cases belong to the same client
  const clientIds = new Set(candidateCases.map((c) => c.client?.id).filter(Boolean));

  if (clientIds.size === 1) {
    // Calculate score gap
    const scoreGap = topScore - secondScore;

    // If there's a clear winner (gap >= MIN_GAP), auto-assign
    if (topAssignment && scoreGap >= THRESHOLDS.MIN_GAP) {
      return {
        state: EmailClassificationState.Classified, // <-- Goes here, NOT ClientInbox
        ...
      };
    }

    // No clear winner - route to ClientInbox
    return {
      state: EmailClassificationState.ClientInbox, // <-- Never reaches here
      ...
    };
  }
}
```

The scoring weights are:

- THREAD_CONTINUITY: 100 (deterministic - same conversationId)
- REFERENCE_NUMBER: 50 (case reference in subject/body)
- TITLE_MATCH: 40 (case title keyword found)
- CLIENT_NAME_MATCH: 35 (client name in email)
- KEYWORD_SUBJECT: 30 (case keyword in subject)
- ACTOR_MATCH: 25 (actor name/org in email)
- KEYWORD_BODY: 20 (case keyword in body)
- RECENT_ACTIVITY: 20 (email within 7 days of last case activity)
- CONTACT_MATCH: 10 (base score for contact association)

With these weights, even a single keyword match in the subject (30 points) or reference number (50 points) creates a gap >= 20, triggering auto-assignment.

### Database Evidence

```sql
-- Current classification states (all emails, no ClientInbox!)
classification_state | count | distinct_clients
---------------------+-------+------------------
Uncertain           | 1984  | 0
Pending             | 632   | 0
Classified          | 19    | 0
```

The only client with multiple active cases:

- **T.T. & CO Solaria Grup SRL** with 2 cases: "Anulare incident plata CIP" and "Heliport\*"
- Client email: `solariagrup@gmail.com`

Emails from this client ARE being linked to BOTH cases via `email_case_links` table, but with `Classified` state (not `ClientInbox`):

```sql
email_id                              | case_title
--------------------------------------+----------------------------
86955950-bd0e-4261-affe-f11cba843815 | Anulare incident plata CIP
86955950-bd0e-4261-affe-f11cba843815 | Heliport*
```

### Why It Wasn't Caught

1. The multi-case email support (OPS-059) was designed to link emails to multiple cases
2. The ClientInbox feature (OPS-195) was designed for ambiguous cases requiring manual assignment
3. The scoring algorithm is working correctly - it's just too good at finding winners
4. No tests exist for the threshold behavior
5. The only multi-case client has strong keyword matches in emails (case numbers, legal terms) making scoring decisive

---

## Impact Assessment

**Affected functionality**:

- Client inbox email view (never populated)
- Manual case assignment workflow for multi-case clients
- User expectation of reviewing emails before case assignment

**Blast radius**: Localized - only affects multi-case client email routing

**Related code**:

- `services/gateway/src/services/classification-scoring.ts`: Scoring and threshold logic
- `services/gateway/src/workers/email-categorization.worker.ts`: State assignment
- `apps/web/src/components/email/EmailCaseSidebar.tsx`: UI for client inbox

**Risk of similar bugs**: Medium - other threshold-based decisions might have similar issues

---

## Proposed Fix Approaches

### Option A: Lower the MIN_GAP threshold

**Approach**: Reduce `MIN_GAP` from 20 to a lower value (e.g., 10 or 5) so more emails go to ClientInbox

**Files to change**:

- `services/gateway/src/services/classification-scoring.ts`: Change `MIN_GAP: 20` to `MIN_GAP: 10`

**Pros**:

- Simple one-line change
- More emails will require manual confirmation

**Cons**:

- May create too many emails requiring manual assignment
- Doesn't address the fundamental design question of when to auto-assign

**Risk**: Low

### Option B: Add a "needsConfirmation" flag without changing auto-assign

**Approach**: Keep auto-assign behavior but set `needsConfirmation: true` on the EmailCaseLink for multi-case scenarios. Show a confirmation UI in the email detail view.

**Files to change**:

- `services/gateway/src/services/classification-scoring.ts`: Return `needsConfirmation: true` even when auto-assigning
- `services/gateway/src/workers/email-categorization.worker.ts`: Set `needsConfirmation` on EmailCaseLink
- `apps/web/src/components/email/ThreadDetail.tsx`: Show confirmation banner

**Pros**:

- Emails still get auto-assigned (no workflow disruption)
- Users see a prompt to confirm/reassign when viewing
- Existing functionality preserved

**Cons**:

- More complex implementation
- Users might miss the confirmation banner

**Risk**: Medium

### Option C: Change ClientInbox logic to always route multi-case emails

**Approach**: When `needsConfirmation` is true (sender has 2+ cases with same client), always route to ClientInbox regardless of score gap

**Files to change**:

- `services/gateway/src/services/classification-scoring.ts`: Remove the score gap check for same-client multi-case scenarios

**Pros**:

- All multi-case client emails go to client inbox
- Clear workflow for manual assignment
- Matches user expectation

**Cons**:

- Removes intelligent auto-assignment
- More manual work for users

**Risk**: Low

### Recommendation

**Option C** is recommended because:

1. It matches the user's expectation that client-level emails should be visible for review
2. The current auto-assign is too aggressive for multi-case scenarios
3. Users should have visibility into which case an email is assigned to when ambiguous
4. The implementation is straightforward

However, **Option B** could be considered if users prefer auto-assignment with a review mechanism rather than manual assignment.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Emails from `solariagrup@gmail.com` (multi-case client) go to `ClientInbox` state
2. [ ] The "Inbox Client" section appears under "T.T. & CO Solaria Grup SRL" in the sidebar
3. [ ] `client_id` field is populated on ClientInbox emails
4. [ ] Assigning from ClientInbox to a case works correctly
5. [ ] Single-case contacts still auto-classify normally
6. [ ] Thread continuity still takes precedence (same thread → same case)

### Suggested Test Cases

```typescript
// classification-scoring.test.ts
describe('ClassificationScoringService', () => {
  describe('ClientInbox routing', () => {
    it('should route to ClientInbox when sender has 2+ cases with same client', async () => {
      // Setup: Create client with 2 active cases
      // Action: Classify email from client email
      // Assert: state === 'ClientInbox', clientId set
    });

    it('should NOT route to ClientInbox when sender has cases with different clients', async () => {
      // Setup: Create contact on cases with different clients
      // Action: Classify email
      // Assert: state === 'Classified' (best match wins)
    });

    it('should prefer thread continuity over ClientInbox routing', async () => {
      // Setup: Create email in existing thread assigned to case A
      // Action: Classify new email in same thread
      // Assert: Goes to case A, not ClientInbox
    });
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                          | Purpose                    | Relevant Finding                                                    |
| ------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `services/gateway/src/services/classification-scoring.ts`     | Email classification logic | MIN_GAP threshold (20) is too strict                                |
| `services/gateway/src/workers/email-categorization.worker.ts` | State assignment           | Correctly handles ClientInbox state when returned                   |
| `apps/web/src/components/email/EmailCaseSidebar.tsx`          | UI rendering               | Correctly shows Inbox Client when inboxTotalCount > 0               |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts`   | emailsByCase query         | Correctly fetches ClientInbox emails and transforms to inboxThreads |

### Database Analysis

```sql
-- Classified emails from multi-case client are linked to BOTH cases
SELECT email_id, case_title FROM email_case_links JOIN cases ON ...
-- But state is 'Classified', not 'ClientInbox'

-- client_id is NULL on all emails
SELECT client_id FROM emails WHERE classification_state = 'Classified'
-- All NULL - clientId is never set because ClientInbox state is never reached
```

### Questions Answered During Investigation

- Q: Are client inbox emails in the database?
- A: No - 0 emails have `ClientInbox` state

- Q: Is the UI set up to display client inbox?
- A: Yes - `ClientAccordion` component shows "Inbox Client" section when `inboxTotalCount > 0`

- Q: Why are multi-case emails being auto-assigned?
- A: The scoring algorithm finds a clear winner (gap >= 20) due to keyword/reference matches

- Q: Is multi-case email linking working?
- A: Yes - `email_case_links` table shows emails linked to multiple cases

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug client-inbox-missing
```

The debug phase will:

1. Read this investigation document
2. Propose the specific implementation (Option C recommended)
3. Get approval before making changes
4. Implement and verify the fix
