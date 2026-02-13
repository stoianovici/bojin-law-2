# Investigation: Noventa and Omega Residential Emails Not Syncing

**Slug**: email-sync
**Date**: 2026-02-01
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug email-sync` to implement fix

---

## Bug Summary

**Reported symptom**: Emails for Noventa (client) and Omega Residential entities are no longer syncing/being attributed properly.

**Actual behavior observed**:

1. Emails ARE being synced (they exist in the database)
2. Emails are NOT being linked to cases or clients
3. All relevant emails are classified as `Uncertain` or `CourtUnassigned`
4. Classification reasons include "AI returned invalid case ID" and "AI classification failed"

**Root cause**: Two separate but related issues:

1. **Noventa has NO cases** - The client exists but has no associated cases (Active or otherwise), so there's nothing to match against
2. **Omega Residential has a case but NO case actors** - The case exists but has no `CaseActor` records, so the contact matching rules fail

**Frequency**: 100% - All emails from these entities since the classification refactor

---

## Root Cause Analysis

### The Bug

**Root cause**: The email classification system relies on `CaseActor` records for contact-based matching, but these entities have no actors configured. The AI fallback is also failing because:

- For Omega: AI returns case IDs that don't validate (possibly case UUIDs from older sessions)
- For Noventa: No case exists to match against at all

**Location**:

- `services/gateway/src/services/ai-email-classifier.service.ts:242-278` (actor email match)
- `services/gateway/src/services/contact-matcher.ts:150-186` (actor matches)

**Code path**:

```
Email received → Filter check (pass) → Thread check (no match) →
Case signal check (no reference numbers) → Court source (some match) →
Actor email match (FAILS - no CaseActors) → Actor domain match (FAILS) →
AI classification (FAILS - returns invalid case ID or fails completely) →
Result: Uncertain
```

**Type**: Data/Configuration bug - missing required data for classification to work

### Why It Happens

The email classification pipeline was redesigned in commit `a9095162` to use a modular architecture with these phases:

1. **Filter list** - check PersonalContact (works)
2. **Thread continuity** - follow existing classification (works, but no prior classifications)
3. **Case signals** - reference numbers, keywords, patterns (works, but not configured)
4. **Court source** - mark court emails (works)
5. **Actor email match** - exact email match against `CaseActor.email` (FAILS - no actors)
6. **Actor domain match** - domain match against `CaseActor.emailDomains` (FAILS - no actors)
7. **AI classification** - LLM fallback (FAILS - returns invalid IDs)

The critical issue is that the system looks at `CaseActor` records but NOT at:

- `Client.contacts` array (JSON field with contact emails)
- `Client.administrators` array (JSON field with admin emails)
- `Client.contactInfo.email` (direct client email)

The `ContactMatcherService` (lines 230-290) DOES check client contacts, but it's used by the older non-AI pipeline (`email-classifier.ts`), not the new AI classifier (`ai-email-classifier.service.ts`).

### Production Data State

**Noventa Romania** (`21657f02-939e-453e-a8ef-729a4b07e86d`):

- Has 0 cases (neither Active nor Archived)
- Has contacts: `radu.cotuna@noventa.com`, `adrian.stepan@bmlaw.ro`
- Emails mentioning "Noventa" exist but are classified as `Uncertain`
- Court response from `tr-timis-reg@just.ro` classified as `CourtUnassigned`
- Email subjects mention "dosar 4440/30/2025" - suggests a case should exist

**Omega Residential S.R.L.** (`2e5445c2-7a6c-466b-8162-1cf5fa858123`):

- Has 1 Active case: `51f2f797-2026-001` (`3b3a3ffd-bdda-4eab-964a-1b331242c318`)
- Has contacts: `radu.ionet83@gmail.com`, `j.tamman@hotmail.com` (note: one contact has typo "roventa.florin@yahoo,com" - comma instead of dot)
- Has 0 case actors configured
- Emails from contacts exist but are all `Uncertain`

**Email Sync State**:

- No active Graph subscriptions (all `subscription_id` fields are NULL)
- Last sync was on 2026-01-30 19:01 for Lucian
- Syncs appear to be manual/triggered, not real-time webhook-based

### Why It Wasn't Caught

1. The classification refactor focused on the AI pipeline but didn't verify that client contact matching was preserved
2. The older `ContactMatcherService` checks client contacts, but the new `AIEmailClassifierService` only checks `CaseActor` records
3. No automated tests verify that client contacts (not just case actors) trigger proper classification
4. The issue only manifests when a client has contacts configured but no corresponding case actors

---

## Impact Assessment

**Affected functionality**:

- Email auto-classification for Noventa client
- Email auto-classification for Omega Residential case
- Historical email linking for these entities
- Potentially other clients/cases with contacts but no case actors

**Blast radius**: Moderate - affects specific entities without case actors configured

**Related code**:

- `services/gateway/src/services/ai-email-classifier.service.ts`: Missing client contact checks
- `services/gateway/src/services/contact-matcher.ts`: Has the logic but isn't used by AI pipeline
- `services/gateway/src/workers/email-categorization.worker.ts`: Orchestrates classification

**Risk of similar bugs**: High - any entity with client contacts but no case actors will have this issue

---

## Proposed Fix Approaches

### Option A: Add Client Contact Matching to AI Classifier (Recommended)

**Approach**: Add a phase to `AIEmailClassifierService` that checks client contacts before falling back to AI, similar to how `ContactMatcherService` does it.

**Files to change**:

- `services/gateway/src/services/ai-email-classifier.service.ts`: Add `checkClientContactMatch()` method

**Logic to add**:

```typescript
// Phase 1.5: Client contact email match (after actor email, before domain)
private async checkClientContactMatch(senderEmail: string, firmId: string): Promise<AIClassificationResult | null> {
  // Check Client.contactInfo.email, Client.contacts[].email, Client.administrators[].email
  // If match found and client has exactly 1 active case -> Classified
  // If match found and client has multiple active cases -> ClientInbox
  // If match found but no active cases -> ClientInbox (with clientId only)
}
```

**Pros**:

- Fixes the issue for all clients with contacts configured
- Maintains the fast-rule philosophy of the AI classifier
- Consistent with existing architecture

**Cons**:

- Duplicates some logic from ContactMatcherService

**Risk**: Low

### Option B: Use ContactMatcherService in AI Pipeline

**Approach**: Call `contactMatcherService.findContactMatch()` in the AI classifier before falling back to AI.

**Files to change**:

- `services/gateway/src/services/ai-email-classifier.service.ts`: Import and use ContactMatcherService

**Pros**:

- Reuses existing, tested code
- Single source of truth for contact matching

**Cons**:

- ContactMatcherService returns different result structure, needs mapping
- May include logic we don't want in the AI pipeline

**Risk**: Low

### Option C: Create CaseActors for Existing Contacts (Data Fix Only)

**Approach**: Write a migration to create `CaseActor` records from existing client contacts for active cases.

**Files to change**:

- New migration script in `services/gateway/src/migrations/`

**Pros**:

- Works with existing classification logic
- Explicit case-contact relationships

**Cons**:

- Doesn't fix the underlying issue (new clients will have same problem)
- Requires users to manage actors AND contacts separately
- Data duplication

**Risk**: Medium - changes data model assumptions

### Recommendation

**Option B** is recommended because:

1. Reuses existing, tested ContactMatcherService code
2. Single source of truth for contact matching logic
3. Less code duplication
4. Already handles all edge cases (single case, multiple cases, no cases)

Additionally, we should:

1. Create a case for Noventa Romania (seems like it should have one based on email subjects mentioning "dosar 4440/30/2025")
2. Verify all clients with contacts have proper case actors going forward
3. Fix the typo in Omega contact email (`roventa.florin@yahoo,com` → `roventa.florin@yahoo.com`)

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Emails from `radu.ionet83@gmail.com` are classified to Omega Residential case
2. [ ] Emails from `j.tamman@hotmail.com` are classified to Omega Residential case
3. [ ] Emails from `radu.cotuna@noventa.com` route to ClientInbox (if no case) or case (if created)
4. [ ] Existing classification behavior for entities WITH case actors still works
5. [ ] AI fallback still works when no contact match is found

### Suggested Test Cases

```typescript
// ai-email-classifier.service.test.ts
describe('AIEmailClassifierService', () => {
  it('should classify email by client contact when no case actors exist', async () => {
    // Create client with contacts but no case actors
    // Send email from contact
    // Verify classification matches the case
  });

  it('should route to ClientInbox when client has multiple active cases', async () => {
    // Create client with contacts and 2+ active cases
    // Send email from contact
    // Verify state is ClientInbox with clientId set
  });

  it('should route to ClientInbox when client has no active cases', async () => {
    // Create client with contacts but no cases
    // Send email from contact
    // Verify state is ClientInbox with clientId set
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                           | Purpose                      | Relevant Finding                                             |
| -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------ |
| `services/gateway/src/services/ai-email-classifier.service.ts` | AI classification pipeline   | Only checks CaseActor, not Client contacts                   |
| `services/gateway/src/services/email-classifier.ts`            | Original classification      | Uses ContactMatcherService which checks client contacts      |
| `services/gateway/src/services/contact-matcher.ts`             | Contact matching logic       | Has full client contact matching but not used by AI pipeline |
| `services/gateway/src/workers/email-categorization.worker.ts`  | Classification orchestration | Calls AI classifier for new emails                           |

### Git History

- `a9095162` - "refactor(email): redesign classification system with modular architecture" - This is where the AI classifier was introduced
- `c4554f58` - "feat(context): unified context UI components and email attribution fix" - Fixed isPrimary but didn't address contact matching
- `e91bb479` - "feat(email): AI-powered email classification pipeline" - Enhanced AI classification

### Production Database Queries

```sql
-- Verified no cases for Noventa
SELECT * FROM cases WHERE client_id = '21657f02-939e-453e-a8ef-729a4b07e86d';
-- Result: 0 rows

-- Verified no case actors for Omega case
SELECT * FROM case_actors WHERE case_id = '3b3a3ffd-bdda-4eab-964a-1b331242c318';
-- Result: 0 rows

-- Found emails from Omega contacts marked as Uncertain
SELECT * FROM emails WHERE "from"->>'address' IN ('radu.ionet83@gmail.com', 'joseph.tamman@hotmail.com');
-- Result: Multiple emails, all Uncertain classification
```

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-sync
```

The debug phase will:

1. Read this investigation document
2. Implement Option B: Use ContactMatcherService in AI pipeline
3. Add check between actor email match and actor domain match
4. Handle single-case vs multi-case scenarios
5. Trigger reclassification for affected emails
