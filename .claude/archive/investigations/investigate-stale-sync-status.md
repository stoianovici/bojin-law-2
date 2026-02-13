# Investigation: "Sincronizare in curs" Appears for Cases Without Active Sync

**Slug**: stale-sync-status
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: Medium
**Next step**: `/debug stale-sync-status` to implement fix

---

## Bug Summary

**Reported symptom**: Cases display "Sincronizare in curs..." (sync in progress) indicator in both the case list and case detail panel, even though these cases don't actually have any sync activity happening.

**Reproduction steps**:

1. View cases list or open case detail panel
2. Observe sync progress indicator on cases that have no active sync jobs

**Expected behavior**: Either no sync indicator at all, or an indicator explaining why sync isn't happening (e.g., "No contacts to sync")

**Actual behavior**: Cases show "Sincronizare in curs..." indefinitely with an animated progress bar

**Frequency**: Affects all cases that existed before the sync feature was added, plus any cases where sync jobs failed silently

---

## Root Cause Analysis

### The Bug

**Root cause**: The database schema defaults `syncStatus` to `'Pending'`, and when the migration added this column to existing cases, all pre-existing cases received `syncStatus = 'Pending'` without any corresponding sync jobs being queued.

**Location**: `packages/database/prisma/migrations/20260110110000_sync_schema_with_codebase/migration.sql:158`

**Code path**:

```
Migration runs → sync_status column added with DEFAULT 'Pending' →
All existing cases get syncStatus='Pending' → No sync jobs queued →
UI checks syncStatus → Displays "Sincronizare in curs..." forever
```

**Type**: Data migration bug / State initialization bug

### Why It Happens

The sync feature was added with these components:

1. **Schema** (`packages/database/prisma/schema.prisma:314`):

   ```prisma
   syncStatus CaseSyncStatus @default(Pending) @map("sync_status")
   ```

2. **Migration** (line 158):

   ```sql
   ALTER TABLE "cases" ADD COLUMN "sync_status" "CaseSyncStatus" NOT NULL DEFAULT 'Pending';
   ```

3. **UI Display** (`apps/web/src/components/cases/CaseSyncProgress.tsx:117`):

   ```typescript
   // Pending or Syncing state - show animated progress bar
   if (!compact) {
     <span>Sincronizare in curs...</span>
   }
   ```

4. **createCase logic** (`services/gateway/src/graphql/resolvers/case.resolvers.ts:909-927`):
   - If user has access token → queue sync job
   - If no access token → set syncStatus to 'Completed'

The problem is that:

1. Existing cases got `syncStatus = 'Pending'` from the migration
2. No sync jobs were ever queued for these cases
3. The UI shows "sync in progress" for ANY case with `syncStatus = 'Pending'` or `'Syncing'`
4. There's no mechanism to detect and clear stale sync states

### Additional Failure Scenarios

Beyond the migration issue, several other scenarios can cause this bug:

1. **queueCaseSyncJob fails silently** (`case.resolvers.ts:909-919`):

   ```typescript
   try {
     await queueCaseSyncJob({...});
   } catch (syncError) {
     console.error('[createCase] Failed to queue sync job:', syncError);
     // syncStatus stays as 'Pending' - never updated!
   }
   ```

2. **Worker never runs**: If Redis or the worker process isn't running, queued jobs never process

3. **Worker crashes mid-sync**: If `startCaseSync` sets status to 'Syncing' then crashes before completion

4. **Historical sync jobs never complete**: When `startCaseSync` queues historical jobs, it returns immediately with status 'Syncing'. If those jobs never complete, status stays 'Syncing' forever.

### Why It Wasn't Caught

1. Migration didn't include a data fix for existing cases
2. No test coverage for the case where sync jobs fail to queue
3. No monitoring/alerting for stale sync states
4. The 5-minute "stale" timeout in `useCaseSyncStatus.ts` only applies after the UI loads (doesn't fix the underlying data)

---

## Impact Assessment

**Affected functionality**:

- Case list view displays confusing sync indicators
- Case detail panel shows misleading progress bars
- Users may repeatedly try to "retry" sync for cases that have nothing to sync

**Blast radius**: Wide - affects all existing cases from before the feature was added

**Related code**:

- `apps/web/src/components/cases/CaseSyncProgress.tsx`: Displays the sync UI
- `apps/web/src/components/cases/CaseCard.tsx`: Uses sync status
- `apps/web/src/components/cases/CaseRow.tsx`: Uses sync status
- `apps/web/src/components/cases/CaseDetailPanel.tsx`: Uses sync status
- `apps/web/src/hooks/useCaseSyncStatus.ts`: Polling logic with stale detection

**Risk of similar bugs**: Medium - any future migrations that add status columns with non-terminal defaults could have the same issue

---

## Proposed Fix Approaches

### Option A: Data Migration Fix (Recommended)

**Approach**: Create a migration to set `syncStatus = 'Completed'` for all cases that:

- Have `syncStatus = 'Pending'` or `'Syncing'`
- AND have no pending/in-progress historical sync jobs
- AND were created before a certain date (or have no sync jobs at all)

**Files to change**:

- `packages/database/prisma/migrations/YYYYMMDD_fix_stale_sync_status/migration.sql`: New migration

**SQL**:

```sql
-- Fix cases with stale sync status that have no active sync jobs
UPDATE cases c
SET sync_status = 'Completed'
WHERE c.sync_status IN ('Pending', 'Syncing')
AND NOT EXISTS (
  SELECT 1 FROM historical_email_sync_jobs h
  WHERE h.case_id = c.id
  AND h.status IN ('Pending', 'InProgress')
);
```

**Pros**:

- Fixes all existing data
- One-time fix, no ongoing maintenance
- Simple and safe

**Cons**:

- Doesn't prevent future occurrences

**Risk**: Low

### Option B: Fix createCase Error Handling

**Approach**: When `queueCaseSyncJob` fails, set `syncStatus` to 'Completed' instead of leaving it as 'Pending'

**Files to change**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts:909-927`

**Code change**:

```typescript
if (context.user?.accessToken) {
  try {
    await queueCaseSyncJob({...});
  } catch (syncError) {
    console.error('[createCase] Failed to queue sync job:', syncError);
    // FIX: Don't leave syncStatus as 'Pending' when queueing fails
    await prisma.case.update({
      where: { id: newCase.id },
      data: { syncStatus: 'Completed' },
    });
  }
} else {
  await prisma.case.update({
    where: { id: newCase.id },
    data: { syncStatus: 'Completed' },
  });
}
```

**Pros**:

- Prevents future occurrences
- Simple fix

**Cons**:

- Doesn't fix existing stale data

**Risk**: Low

### Option C: UI Fix - Hide Sync for Old Cases

**Approach**: Don't show sync progress for cases that are older than a threshold (e.g., created before the feature was added)

**Pros**:

- Quick cosmetic fix

**Cons**:

- Doesn't fix underlying data issue
- Magic date threshold is fragile
- Not a real solution

**Risk**: Low but hacky

### Recommendation

**Implement both Option A and Option B**:

1. Option A (migration) fixes all existing stale data
2. Option B (error handling) prevents future occurrences

Together they fully address both the historical data and prevent future regressions.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Existing cases with stale 'Pending' status now show no sync indicator
2. [ ] Existing cases with stale 'Syncing' status now show no sync indicator
3. [ ] Newly created cases without contacts show no sync indicator (syncStatus = 'Completed')
4. [ ] Cases with actual sync jobs still show sync progress correctly
5. [ ] If queueCaseSyncJob throws, case is marked as 'Completed' (not stuck at 'Pending')

### Suggested Test Cases

```typescript
// case.resolvers.test.ts
describe('createCase sync status', () => {
  it('should set syncStatus to Completed when no contacts and no access token', async () => {
    // Test case creation without MS token
  });

  it('should set syncStatus to Completed when queueCaseSyncJob fails', async () => {
    // Mock queueCaseSyncJob to throw
    // Verify case.syncStatus is 'Completed'
  });

  it('should queue sync job and leave syncStatus as Pending when user has token', async () => {
    // Verify job is queued
    // Verify syncStatus starts as 'Pending'
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                                                             | Purpose            | Relevant Finding                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------ |
| `packages/database/prisma/schema.prisma:314`                                                     | Schema definition  | `syncStatus` defaults to `'Pending'`                                           |
| `packages/database/prisma/migrations/20260110110000_sync_schema_with_codebase/migration.sql:158` | Migration          | Added column with DEFAULT 'Pending' to all existing cases                      |
| `apps/web/src/components/cases/CaseSyncProgress.tsx`                                             | UI component       | Shows "Sincronizare in curs..." for Pending/Syncing states                     |
| `apps/web/src/hooks/useCaseSyncStatus.ts`                                                        | Hook               | Polls for sync status, has 5-min stale detection                               |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts:909-927`                               | createCase         | Queues sync job or sets Completed, but error handling leaves status as Pending |
| `services/gateway/src/services/case-sync.service.ts`                                             | Sync orchestration | Handles no-contacts case correctly (sets Completed)                            |
| `services/gateway/src/workers/case-sync.worker.ts`                                               | Worker             | Processes sync jobs                                                            |
| `services/gateway/src/workers/historical-email-sync.worker.ts`                                   | Worker             | Updates case sync status on completion                                         |

### Git History

Migration was added in: `20260110110000_sync_schema_with_codebase`

This migration synced the schema with codebase changes but didn't include a data fix for existing cases.

### Questions Answered During Investigation

- Q: Why do cases with no contacts still show sync progress?
- A: The migration set all existing cases to `syncStatus = 'Pending'` without queueing any sync jobs. The UI displays sync progress for any case with Pending/Syncing status.

- Q: When should sync status be hidden?
- A: When `syncStatus` is null or 'Completed'. The component already handles this correctly.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug stale-sync-status
```

The debug phase will:

1. Read this investigation document
2. Create migration to fix existing stale data
3. Fix createCase error handling to prevent future occurrences
4. Verify the fix works
