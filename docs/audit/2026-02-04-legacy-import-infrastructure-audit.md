# Legacy Import Infrastructure Audit

**Date:** 2026-02-04
**Session ID:** 8267942a-3721-4956-b866-3aad8e56a1bb
**Status:** CRITICAL - Incomplete upload, data at risk

---

## Executive Summary

The legacy import system experienced an incomplete upload of ~29,717 documents. Investigation found that:

1. **No data was permanently lost** - All 29,717 source files exist locally (23GB)
2. **Upload was incomplete** - Only 9,130 files (31%) made it to R2
3. **20,587 files need to be uploaded** - Estimated ~18GB remaining
4. **Root cause:** Upload script was interrupted without state persistence

---

## Current State

| Metric           | Value                |
| ---------------- | -------------------- |
| Database records | 29,717 documents     |
| R2 bucket files  | 9,130 files          |
| Local files      | 29,717 files (23GB)  |
| Missing from R2  | 20,587 files (~18GB) |
| Size mismatches  | 0                    |

### Storage Path Analysis

Database storage paths use pattern: `legacy-import/{sessionId}/{docId}.{ext}`

This is **different** from the default pattern in `r2-storage.ts`:

- Library default: `documents/{sessionId}/{docId}.{ext}`
- Actual data: `legacy-import/{sessionId}/{docId}.{ext}`

This mismatch means:

- Document proxy works correctly (reads path from DB)
- Cleanup functions in r2-storage.ts will NOT find these files
- Manual cleanup scripts must use correct prefix

---

## Infrastructure Issues Identified

### 1. CRITICAL: Upload-Before-Transaction Pattern

**Location:** `apps/legacy-import/src/app/api/extract-documents/route.ts`

**Problem:** R2 uploads happen OUTSIDE database transactions:

```typescript
// File uploaded to R2 (not in transaction)
const uploadResult = await uploadExtractedDocument(...);

// Database creation in transaction (could fail)
await prisma.$transaction(async (tx) => {
  await tx.extractedDocument.create({ storagePath: uploadResult.key })
});
```

**Impact:** If database transaction fails after R2 upload, orphaned files remain in R2 with no database record.

**Recommendation:** Implement compensating transaction or two-phase commit pattern.

### 2. HIGH: No Upload Progress Persistence

**Location:** `scripts/upload-legacy-docs-to-r2.ts`

**Problem:** Original upload script has no state persistence:

- If interrupted, must re-scan R2 to determine what's uploaded
- No retry logic for failed uploads
- No logging of failures

**Fix Applied:** Created `scripts/upload-legacy-docs-robust.ts` with:

- State persistence to disk
- Retry logic with exponential backoff
- Detailed logging
- Size verification

### 3. HIGH: Storage Path Inconsistency

**Problem:** Multiple path patterns in use:

| Component                   | Path Pattern                     |
| --------------------------- | -------------------------------- |
| r2-storage.ts (library)     | `documents/{sessionId}/`         |
| upload-legacy-docs-to-r2.ts | `legacy-import/{sessionId}/`     |
| Database records            | `legacy-import/{sessionId}/`     |
| Cleanup functions           | `documents/{sessionId}/` (WRONG) |

**Impact:**

- Cleanup functions will not find files
- Session cleanup will fail silently
- Orphaned files will accumulate

**Recommendation:** Standardize on one pattern and update cleanup functions.

### 4. MEDIUM: No Orphan Detection

**Problem:** No mechanism to detect:

- R2 files without database records
- Database records pointing to missing R2 files

**Recommendation:** Implement reconciliation endpoint or scheduled job.

### 5. MEDIUM: Cleanup Not Atomic

**Location:** `apps/legacy-import/src/app/api/cleanup-session/route.ts`

**Problem:** Database cascade deletes don't trigger R2 cleanup:

- User deletes session → DB records deleted → R2 files orphaned

**Recommendation:** Implement pre-delete hook to cleanup R2 first.

### 6. LOW: No Multipart Upload Abort

**Problem:** Incomplete multipart uploads remain in R2 indefinitely.

**Recommendation:** Configure R2 lifecycle policy to auto-abort incomplete uploads after 7 days.

---

## Root Cause Analysis

### Why Did Upload Stop?

The upload appears to have been interrupted at approximately file #9,130 (sorted alphabetically). Possible causes:

1. **Terminal/SSH session terminated**
2. **System sleep/shutdown**
3. **R2 rate limiting** (unlikely with concurrency=10)
4. **Network interruption**
5. **Manual Ctrl+C**

The original script had no:

- State persistence
- Resume capability
- Failure notifications
- Progress logging to file

---

## Recovery Plan

### Immediate Actions

1. **Complete the upload** using the robust script:

   ```bash
   cd /Users/mio/Developer/bojin-law-2
   npx tsx scripts/upload-legacy-docs-robust.ts
   ```

2. **Monitor progress:**

   ```bash
   tail -f scripts/.upload-log-8267942a-3721-4956-b866-3aad8e56a1bb.txt
   ```

3. **Verify completion:**
   ```bash
   npx tsx scripts/upload-legacy-docs-robust.ts --verify-only
   ```

### Post-Recovery Verification

After upload completes, verify document accessibility:

```bash
# Check a sample document loads
curl "http://localhost:3001/api/document-proxy?documentId=<sample-id>"
```

---

## Recommendations

### Short-term (This Week)

1. [ ] Complete upload using robust script
2. [ ] Verify all 29,717 documents accessible
3. [ ] Fix cleanup function to use correct path prefix
4. [ ] Add Discord/Slack webhook for upload failures

### Medium-term (This Month)

1. [ ] Standardize storage path pattern across codebase
2. [ ] Implement orphan detection reconciliation job
3. [ ] Add checksums to verify file integrity
4. [ ] Configure R2 lifecycle policies

### Long-term (This Quarter)

1. [ ] Implement two-phase commit for uploads
2. [ ] Add event sourcing for document operations
3. [ ] Create automated backup verification
4. [ ] Implement distributed locking for concurrent operations

---

## Files Modified/Created

| File                                   | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `scripts/upload-legacy-docs-robust.ts` | Resumable upload script with retries |
| `scripts/analyze-upload-status.ts`     | Upload gap analysis tool             |

---

## Appendix: Robust Upload Script Usage

```bash
# Dry run (see what would be uploaded)
npx tsx scripts/upload-legacy-docs-robust.ts --dry-run

# Verify current state
npx tsx scripts/upload-legacy-docs-robust.ts --verify-only

# Full upload (default concurrency=5)
npx tsx scripts/upload-legacy-docs-robust.ts

# Upload with custom concurrency
npx tsx scripts/upload-legacy-docs-robust.ts --concurrency=10
```

State file: `scripts/.upload-state-{sessionId}.json`
Log file: `scripts/.upload-log-{sessionId}.txt`
