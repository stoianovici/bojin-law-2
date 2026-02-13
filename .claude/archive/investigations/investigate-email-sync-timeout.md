# Investigation: Email Sync Worker Timeout

**Slug**: email-sync-timeout
**Date**: 2026-01-14
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug email-sync-timeout` to implement fix

---

## Bug Summary

**Reported symptom**: Historical email sync for client Noventa (radu.cotuna@noventa.com) fails with "Job stalled more than allowable limit - worker timeout"

**Reproduction steps**:

1. Navigate to Email page
2. Select client Noventa > case "Negrea c. Noventa"
3. Observe the red error banner showing sync failure

**Expected behavior**: Historical emails should be synced to the case without timeout

**Actual behavior**: Job stalls and fails with "Job stalled more than allowable limit - worker timeout"

**Frequency**: Consistent - happens every time for this client/case combination

---

## Root Cause Analysis

### The Bug

**Root cause**: BullMQ lock expires during batch processing because lock extension doesn't happen frequently enough when processing emails with attachments.

**Location**: `services/gateway/src/services/historical-email-sync.service.ts:292-395` (`processBatch` method)

**Code path**:

```
queueHistoricalSyncJob → processHistoricalSyncJob → syncHistoricalEmails → fetchEmailsByContact → processBatch → [STALL HERE] → syncAllAttachments
```

**Type**: Race condition / Resource exhaustion

### Why It Happens

The historical email sync worker is configured with:

- `lockDuration: 300000` (5 minutes) - how long a job can run before being considered stalled
- `stalledInterval: 30000` (30 seconds) - how often BullMQ checks for stalled jobs

The sync process:

1. Fetches emails from MS Graph API (found 42 emails)
2. Updates `totalEmails` in database ✓
3. Processes emails in batches of 200 (so 42 emails = 1 batch)
4. For EACH email in batch:
   - Checks if already linked (DB query)
   - Creates EmailCaseLink if needed
   - **If email has attachments**: calls `syncAllAttachments` which:
     - Lists attachments from Graph
     - Downloads each attachment
     - Uploads to SharePoint
     - Creates Document records

The lock is extended ONCE before each `syncAllAttachments` call (line 375-377), but:

- Processing 42 emails with 13+ having attachments takes well over 5 minutes
- Lock extension happens per-email, not per-attachment
- No lock extension during the slow operations (download/upload)
- Progress update (`syncedEmails`) only happens AFTER the entire batch

**Evidence from database**:

```sql
-- Job found 42 emails but synced 0 before stalling
SELECT total_emails, synced_emails, error_message FROM historical_email_sync_jobs WHERE contact_email LIKE '%noventa%';
-- Result: total_emails=42, synced_emails=0
```

This confirms the batch never completed - it stalled during `processBatch`.

### Why It Wasn't Caught

1. **Test coverage gap**: No integration tests that simulate slow attachment operations
2. **Development environment**: Local testing with fast network/small attachments didn't expose timing issues
3. **Lock configuration**: 5-minute lock seemed sufficient but doesn't account for multiple attachments per email
4. **Progress granularity**: Progress only updates per-batch, not per-email or per-attachment

---

## Impact Assessment

**Affected functionality**:

- Historical email sync for any client with many emails + attachments
- Case setup workflow when adding contacts with email history

**Blast radius**: Moderate - only affects historical sync, not regular email sync

**Related code**:

- `historical-email-sync.worker.ts`: Worker configuration
- `historical-email-sync.service.ts`: Sync logic
- `email-attachment.service.ts`: Attachment processing (no lock awareness)

**Risk of similar bugs**: Medium - other long-running workers may have similar issues

---

## Proposed Fix Approaches

### Option A: More Frequent Lock Extension (Recommended)

**Approach**: Extend lock more frequently during batch processing - after each email and during attachment sync.

**Files to change**:

- `services/gateway/src/services/historical-email-sync.service.ts`:
  - Add lock extension inside the email loop in `processBatch` (after each email)
  - Pass `bullmqJob` to `syncAllAttachments` for lock extension during slow operations

**Pros**:

- Direct fix for the root cause
- Minimal code changes
- No architectural changes needed

**Cons**:

- Adds more API calls to BullMQ (minor overhead)

**Risk**: Low

### Option B: Reduce Batch Size + More Progress Updates

**Approach**: Process emails in smaller batches (e.g., 10 instead of 200) and update progress more frequently.

**Files to change**:

- `services/gateway/src/services/historical-email-sync.service.ts`:
  - Change `BATCH_SIZE` from 200 to 10-20
  - Add per-email progress updates

**Pros**:

- More granular progress visible to users
- Natural pause points for lock extension

**Cons**:

- More database writes
- Slower overall (but more reliable)

**Risk**: Low

### Option C: Separate Attachment Sync into Sub-Jobs

**Approach**: Create separate BullMQ jobs for attachment sync, so the main sync job completes quickly.

**Files to change**:

- Create new `attachment-sync.worker.ts`
- Modify `historical-email-sync.service.ts` to queue attachment jobs instead of processing inline

**Pros**:

- Clean separation of concerns
- Each job has its own lock/timeout
- Better retry granularity

**Cons**:

- More complex architecture
- Harder to track overall progress
- More queue management

**Risk**: Medium

### Recommendation

**Option A** - More frequent lock extension is the simplest and most direct fix. The current architecture is sound; it just needs more lock maintenance during long operations.

If Option A alone isn't sufficient (unlikely), combine with Option B for smaller batches.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces with Noventa client
2. [ ] Historical sync completes for clients with 40+ emails
3. [ ] Historical sync completes for clients with many attachments
4. [ ] Progress updates are visible during sync
5. [ ] Failed syncs can be retried successfully

### Suggested Test Cases

```typescript
// historical-email-sync.service.test.ts
describe('HistoricalEmailSyncService', () => {
  it('should extend lock during long attachment syncs', async () => {
    // Mock slow attachment operations
    // Verify extendLock is called multiple times
  });

  it('should complete sync even with many attachments', async () => {
    // Test with 20+ emails, half with attachments
    // Verify all emails are processed
  });

  it('should update progress during batch processing', async () => {
    // Verify progress callback is called per-email, not just per-batch
  });
});
```

---

## Investigation Notes

### Files Examined

| File                               | Purpose               | Relevant Finding                                         |
| ---------------------------------- | --------------------- | -------------------------------------------------------- |
| `historical-email-sync.worker.ts`  | Worker config         | `lockDuration: 300000`, `stalledInterval: 30000`         |
| `historical-email-sync.service.ts` | Sync logic            | Lock extended only once per email before attachment sync |
| `email-attachment.service.ts`      | Attachment processing | No lock awareness, can take minutes per email            |
| `retry.util.ts`                    | Retry logic           | Has exponential backoff, not the issue                   |
| `HistoricalSyncStatus.tsx`         | UI display            | Correctly shows error from `errorMessage` field          |

### Database State

```sql
-- Historical sync job
id: 018a0204-d50e-4a8f-ae11-ae2383a289aa
case_id: 3d2b4f2a-7cd5-4ad7-970c-3ef3652625f1
contact_email: radu.cotuna@noventa.com
status: Failed
total_emails: 42  -- Graph found 42 emails
synced_emails: 0  -- None processed before stall
error_message: Job stalled more than allowable limit - worker timeout
started_at: 2026-01-12 17:44:03
created_at: 2026-01-12 17:41:03

-- Case has 30 emails in DB, 13 with attachments
-- The 42 from Graph vs 30 in DB difference is expected (some may not be synced yet)
```

### Git History

No recent changes to historical sync code that would have introduced this bug. This is a latent issue that manifests with larger email volumes.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug email-sync-timeout
```

The debug phase will:

1. Read this investigation document
2. Implement Option A (more frequent lock extension)
3. Test with the Noventa case
4. Verify the fix
