# Investigation: Email Folder Counts Mismatch

**Slug**: email-folder-counts
**Date**: 2026-01-12
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug email-folder-counts` to implement fix

---

## Bug Summary

**Reported symptom**: After changing the email sync algorithm, the number of emails displayed in each folder in `/email` doesn't match the actual data.

**Reproduction steps**:

1. Navigate to http://localhost:3000/email
2. Observe the email counts in the sidebar
3. Compare with actual database counts

**Expected behavior**: Cases should show the correct count of classified emails (e.g., Heliport\* case with 25 emails should show 25)

**Actual behavior**:

- Cases like "Heliport\*" and "Anulare incident plata CIP" show **0 emails** despite having emails assigned
- INBOX CLIENT shows 18 (correct - thread count)
- NECLAR shows 189 (correct)

**Frequency**: Always

---

## Root Cause Analysis

### The Bug

**Root cause**: The `emailsByCase` resolver queries the `EmailCaseLink` join table for case emails, but existing classified emails only have the legacy `caseId` column set on the Email model - no `EmailCaseLink` records were created for them.

**Location**: `services/gateway/src/graphql/resolvers/email.resolvers.ts:1013-1046`

**Code path**:

```
emailsByCase query → prisma.case.findMany with emailLinks → EmailCaseLink table (EMPTY) → returns 0 threads
```

**Type**: Data migration bug / Schema evolution issue

### Why It Happens

The system has two ways to link emails to cases:

1. **Legacy method** (Email.caseId): Direct foreign key on the Email model

   ```sql
   SELECT COUNT(*) FROM emails WHERE case_id IS NOT NULL;
   -- Returns: 25 (these are the Heliport* emails)
   ```

2. **New method** (EmailCaseLink): Many-to-many join table supporting multi-case assignments
   ```sql
   SELECT COUNT(*) FROM email_case_links;
   -- Returns: 0 (NO RECORDS!)
   ```

The resolver at line 1013-1046 uses `emailLinks` which queries the `EmailCaseLink` table:

```typescript
emailLinks: {
  where: {
    email: {
      classificationState: EmailClassificationState.Classified,
    },
  },
  ...
}
```

The email categorization worker (lines 333-376 in `email-categorization.worker.ts`) NOW correctly creates both:

- Updates `Email.caseId` (line 336) for backward compatibility
- Creates `EmailCaseLink` records (line 347) for the new system

But existing data (25 emails classified to Heliport\*) was created by an older version that only set `Email.caseId` without creating `EmailCaseLink` records.

### Database Evidence

```
         data_source              | count
---------------------------------+-------
 Emails with case_id (old)       |    25
 email_case_links records (new)  |     0

 classification_state | count
----------------------+-------
 Uncertain            |  1687
 Classified           |    25  ← These have case_id but NO EmailCaseLink
 ClientInbox          |    25
```

### Why It Wasn't Caught

1. The feature was developed with fresh test data where the worker created both records
2. Production data had emails classified before the `EmailCaseLink` system was added
3. No migration script was created to backfill `EmailCaseLink` records from existing `Email.caseId` data

---

## Impact Assessment

**Affected functionality**:

- Email sidebar case counts (all cases show 0 instead of actual count)
- Case email threads not visible (cases appear empty)
- Email navigation broken for classified emails

**Blast radius**: High - Primary email management UI is broken

**Related code**:

- `services/gateway/src/graphql/resolvers/email.resolvers.ts:982-1468`: emailsByCase resolver
- `services/gateway/src/workers/email-categorization.worker.ts:333-376`: Worker creates both records (correct)
- `services/gateway/src/graphql/resolvers/email.resolvers.ts:3394`: Manual linking creates both records (correct)

**Risk of similar bugs**: Medium - Any code path that was updated to use EmailCaseLink but doesn't have data migrated

---

## Proposed Fix Approaches

### Option A: Backfill EmailCaseLink Records (Recommended)

**Approach**: Create a migration script that creates `EmailCaseLink` records for all emails that have `caseId` set but no corresponding `EmailCaseLink` record.

**Files to change**:

- `services/gateway/scripts/backfill-email-case-links.ts`: NEW - migration script

**Script logic**:

```typescript
const emailsWithCaseIdButNoLink = await prisma.email.findMany({
  where: {
    caseId: { not: null },
    classificationState: 'Classified',
    caseLinks: { none: {} },
  },
});

for (const email of emailsWithCaseIdButNoLink) {
  await prisma.emailCaseLink.create({
    data: {
      emailId: email.id,
      caseId: email.caseId!,
      linkedBy: 'migration',
      isPrimary: true,
      confidence: email.classificationConfidence || 1.0,
      matchType: 'CONTACT_MATCH',
    },
  });
}
```

**Pros**:

- Fixes the root cause permanently
- Future emails already work correctly
- Single fix, no ongoing code changes needed

**Cons**:

- Requires running migration script
- Need to handle edge cases (deleted cases, etc.)

**Risk**: Low

### Option B: Update Resolver to Use Both Sources

**Approach**: Modify the `emailsByCase` resolver to query both `EmailCaseLink` records AND emails with `caseId` set directly.

**Files to change**:

- `services/gateway/src/graphql/resolvers/email.resolvers.ts`: Modify emailsByCase resolver

**Pros**:

- No migration needed
- Works immediately

**Cons**:

- Adds complexity to the resolver
- Maintains technical debt (two ways to link emails)
- Performance impact from dual queries
- Need to deduplicate results

**Risk**: Medium

### Recommendation

**Option A** - Run a backfill migration script. This is the clean solution that:

1. Fixes existing data to match the new schema
2. Keeps the resolver logic simple
3. Ensures consistency going forward

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - cases show correct email counts
2. [ ] Heliport\* case shows 25 emails (thread grouped)
3. [ ] Email threads are visible when clicking on a case
4. [ ] INBOX CLIENT count still shows 18 (unchanged)
5. [ ] NECLAR count still shows 189 (unchanged)
6. [ ] New email classifications still work correctly

### Database Verification

```sql
-- After migration, this should match:
SELECT
  (SELECT COUNT(*) FROM emails WHERE case_id IS NOT NULL) as emails_with_case_id,
  (SELECT COUNT(DISTINCT email_id) FROM email_case_links) as emails_with_links;

-- Both counts should be equal (currently 25 vs 0)
```

---

## Investigation Notes

### Files Examined

| File                             | Purpose               | Relevant Finding                                |
| -------------------------------- | --------------------- | ----------------------------------------------- |
| `email.resolvers.ts:982-1468`    | emailsByCase resolver | Uses `emailLinks` (join table) not `caseId`     |
| `email-categorization.worker.ts` | Background classifier | Creates BOTH caseId AND EmailCaseLink (correct) |
| `schema.prisma:2690-2707`        | EmailCaseLink model   | Join table for email-case many-to-many          |
| `schema.prisma:1823-1888`        | Email model           | Has both `caseId` and `caseLinks` relations     |

### Database Queries Run

```sql
-- Classification state distribution
 classification_state | count
----------------------+-------
 Uncertain            |  1687
 Classified           |    25  -- These are the problem
 ClientInbox          |    25

-- The mismatch
 Emails with case_id (old system)      | 25
 email_case_links records (new system) |  0
```

### Questions Answered During Investigation

- Q: Why do cases show 0 emails?
- A: Resolver uses EmailCaseLink table which is empty; existing data uses legacy Email.caseId

- Q: Is the current categorization worker correct?
- A: Yes - it creates both Email.caseId AND EmailCaseLink records (lines 333-376)

- Q: Why wasn't this caught earlier?
- A: The feature was developed with fresh data where both records existed

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-folder-counts
```

The debug phase will:

1. Read this investigation document
2. Create the backfill migration script
3. Run the migration
4. Verify the fix via database queries and UI
