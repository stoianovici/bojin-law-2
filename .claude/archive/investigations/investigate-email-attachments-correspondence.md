# Investigation: No Email Attachments Syncing to Documents

**Slug**: email-attachments-correspondence
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: High - Data corruption from reset script
**Next step**: `/debug email-attachments-correspondence` to implement fix

---

## Bug Summary

**Reported symptom**: No attachments from classified emails appear in /documents - Corespondenta

**Reproduction steps**:

1. Sync emails from Outlook
2. Classify emails to a case
3. Navigate to Documents > Corespondenta tab
4. No documents appear, even for emails that should have attachments

**Expected behavior**: Email attachments should be synced to the Corespondenta section

**Actual behavior**: 0 attachments synced; all 1737 emails have `has_attachments = false`

**Frequency**: Always - all emails affected

---

## Root Cause Analysis

### The Bug

**Root cause**: The `reset-email-sync.ts` script intentionally sets `hasAttachments: false` on ALL emails, but the email sync service skips existing emails, so the correct values are never restored.

**Location**: `services/gateway/scripts/reset-email-sync.ts:65-71`

**Code path**:

```
reset-email-sync.ts runs
    └── Sets hasAttachments: false on ALL emails (line 66-70)
         └── Email sync triggered
              └── Skips existing emails (email-sync.service.ts:683)
                   └── hasAttachments stays false forever
                        └── syncAllAttachments() never called (checks hasAttachments first)
```

**Type**: Data corruption from maintenance script

### Why It Happens

The reset script at `services/gateway/scripts/reset-email-sync.ts` contains:

```typescript
// Step 5: Also reset hasAttachments flag to force re-check
console.log('Resetting hasAttachments flags...');
const resetAttachmentFlags = await prisma.email.updateMany({
  data: {
    hasAttachments: false,
  },
});
```

But the email sync service in `email-sync.service.ts:683-685`:

```typescript
// Filter to only new emails
const newEmails = emails.filter((e) => !existingIds.has(e.graphMessageId));

if (newEmails.length === 0) return;
```

This means:

1. Reset script sets `hasAttachments = false` on all emails
2. Email sync runs but skips all existing emails
3. The `hasAttachments` field is never corrected from Graph API data
4. `syncAllAttachments()` checks `hasAttachments` first and skips emails without it

### Evidence

```sql
-- All emails have hasAttachments = false
SELECT has_attachments, COUNT(*) FROM emails GROUP BY has_attachments;
-- Result: f | 1737

-- Zero email attachments exist
SELECT COUNT(*) FROM email_attachments;
-- Result: 0

-- Zero EMAIL_ATTACHMENT documents
SELECT source_type, COUNT(*) FROM documents GROUP BY source_type;
-- Result: UPLOAD | 3
```

### Why It Wasn't Caught

1. The reset script was designed for testing/development but was run on production data
2. No validation that emails actually have their attachment flag restored after sync
3. The comment says "force re-check" but email sync doesn't re-check existing emails

---

## Impact Assessment

**Affected functionality**:

- All email attachment imports
- Corespondenta document section
- Case document completeness

**Blast radius**: Wide - all 1737 synced emails affected

**Related code**:

- `email-attachment.service.ts`: Checks `hasAttachments` before syncing
- `email-classification.resolvers.ts:1067-1089`: Calls `syncAllAttachments`

**Risk of similar bugs**: Medium - other reset scripts may have similar issues

---

## Proposed Fix Approaches

### Option A: Backfill hasAttachments from Graph API (Recommended)

**Approach**: Create a script that queries Graph API for each email and updates the `hasAttachments` field

**Files to change**:

- `services/gateway/scripts/backfill-email-attachments.ts` (new file)

**Pros**:

- Non-destructive - only updates the flag
- Can be run incrementally
- Preserves all other email data

**Cons**:

- Requires valid access token
- Takes time to process all emails (Graph API calls)

**Risk**: Low

### Option B: Delete and re-sync all emails

**Approach**: Delete all emails from DB and trigger full re-sync

**Files to change**: None (use existing scripts)

**Pros**:

- Guaranteed clean data

**Cons**:

- Loses email classification state
- Loses case links
- Disruptive to users

**Risk**: High

### Option C: Fix reset script + partial resync

**Approach**: Fix the reset script to not touch `hasAttachments`, then resync affected emails

**Files to change**:

- `services/gateway/scripts/reset-email-sync.ts`: Remove lines 65-71

**Pros**:

- Prevents future occurrences

**Cons**:

- Doesn't fix existing data

**Risk**: Low

### Recommendation

**Option A** - Create a backfill script to fix `hasAttachments` from Graph API. Also apply **Option C** to prevent this from happening again.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Backfill script successfully updates `hasAttachments` for all emails
2. [ ] Emails with attachments now have `hasAttachments = true`
3. [ ] Classifying an email with attachments creates EmailAttachment records
4. [ ] Documents appear in Corespondenta tab after classification
5. [ ] Reset script no longer clears `hasAttachments` flag

### Verification Queries

```sql
-- Check hasAttachments distribution after fix
SELECT has_attachments, COUNT(*) FROM emails GROUP BY has_attachments;
-- Expected: some emails should have 't' (true)

-- Check email attachments after classifying
SELECT COUNT(*) FROM email_attachments;
-- Expected: > 0 after classifying emails with attachments
```

---

## Investigation Notes

### Files Examined

| File                                  | Purpose         | Relevant Finding                             |
| ------------------------------------- | --------------- | -------------------------------------------- |
| `scripts/reset-email-sync.ts:65-71`   | Reset script    | **Sets hasAttachments: false on ALL emails** |
| `email-sync.service.ts:683-685`       | Email sync      | Skips existing emails, never restores flag   |
| `email-attachment.service.ts:276-287` | Attachment sync | Checks `hasAttachments` before processing    |

### Database State

| Table                        | Count | Notes                              |
| ---------------------------- | ----- | ---------------------------------- |
| emails                       | 1737  | All have `has_attachments = false` |
| email_attachments            | 0     | Never synced                       |
| documents (EMAIL_ATTACHMENT) | 0     | Never created                      |

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-attachments-correspondence
```

The debug phase will:

1. Read this investigation document
2. Create a backfill script to fix `hasAttachments` from Graph API
3. Fix the reset script to prevent future occurrences
4. Verify attachments sync correctly after the fix
