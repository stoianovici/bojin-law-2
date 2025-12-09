# Handoff: [OPS-004] Add Categorization Backup Before Export

**Session**: 2
**Date**: 2025-12-09
**Status**: Fixing (ready to deploy)

## Work Completed This Session

### 1. Schema Updates

- Added `cleanupScheduledAt` field to `LegacyImportSession` - stores when R2 files should be deleted (7 days after export)
- Added `lastSnapshotAt` field to `LegacyImportSession` - tracks when last snapshot was created

### 2. Created `/api/export-snapshot` Endpoint

- **POST**: Creates comprehensive JSON backup of all categorization data:
  - Session info (firmId, pstFileName, stats)
  - All categories with document counts
  - All documents with category assignments
  - All batches with assigned user info
- Uploads snapshot to R2: `backups/{sessionId}/categorization-{timestamp}.json`
- Creates audit log entry with action `CATEGORIZATION_SNAPSHOT`
- **GET**: Returns snapshot status and recent snapshots from audit log

### 3. Modified `/api/export-onedrive`

- **SAFETY**: Now requires a recent snapshot (< 1 hour old) before allowing export
  - Returns `SNAPSHOT_REQUIRED` error if no snapshot exists
  - Returns `SNAPSHOT_STALE` error if snapshot > 1 hour old
  - Can be bypassed with `skipSnapshotCheck: true` (not recommended)
- **NO IMMEDIATE DELETION**: R2 files are no longer deleted after export
  - Instead, sets `cleanupScheduledAt = now + 7 days`
  - Response includes `backup.r2CleanupScheduledAt` and retention info

### 4. Created `/api/cleanup-session` Endpoint

- **POST**: Manually triggers R2 cleanup for exported sessions
  - Requires `confirmDelete: true` to actually delete
  - Without confirmation, returns preview of what would be deleted
  - Warns if no snapshot exists
- **GET**: Lists all sessions pending cleanup with status
  - Shows `isCleanupDue` flag for sessions past scheduled date
  - Shows `daysUntilCleanup` for scheduled sessions

## Current State

All code is implemented and compiles without errors. Ready for deployment.

**Files changed:**

1. `packages/database/prisma/schema.prisma` - Added 2 new fields
2. `apps/legacy-import/src/app/api/export-snapshot/route.ts` - NEW
3. `apps/legacy-import/src/app/api/cleanup-session/route.ts` - NEW
4. `apps/legacy-import/src/app/api/export-onedrive/route.ts` - Modified

## Blockers/Questions

None currently. Ready to deploy.

## Next Steps

1. **Deploy to production**:

   ```bash
   git add -A
   git commit -m "feat(legacy-import): add categorization backup and delayed R2 cleanup (OPS-004)"
   git push
   ```

2. **Run migration on production** (after deploy):
   - The new schema fields need to be added to production DB
   - Use the existing migration endpoint pattern or run:

   ```sql
   ALTER TABLE legacy_import_sessions
   ADD COLUMN IF NOT EXISTS cleanup_scheduled_at TIMESTAMPTZ,
   ADD COLUMN IF NOT EXISTS last_snapshot_at TIMESTAMPTZ;
   ```

3. **Verify endpoints work**:
   - POST `/api/export-snapshot` with `{ sessionId: "..." }`
   - GET `/api/export-snapshot?sessionId=...`
   - GET `/api/cleanup-session` (list all pending)
   - POST `/api/cleanup-session` with `{ sessionId: "...", confirmDelete: false }` (preview)

4. **Before 8K document export**:
   - Create a snapshot first
   - Then proceed with export
   - R2 files will be retained for 7 days after export

## Key Files

| File                                                      | Purpose                                      |
| --------------------------------------------------------- | -------------------------------------------- |
| `apps/legacy-import/src/app/api/export-snapshot/route.ts` | Backup creation endpoint                     |
| `apps/legacy-import/src/app/api/cleanup-session/route.ts` | Manual R2 cleanup trigger                    |
| `apps/legacy-import/src/app/api/export-onedrive/route.ts` | Modified to require snapshot + delay cleanup |
| `packages/database/prisma/schema.prisma`                  | Added cleanupScheduledAt, lastSnapshotAt     |

## API Reference

### POST /api/export-snapshot

```json
// Request
{ "sessionId": "uuid" }

// Response
{
  "success": true,
  "snapshotAt": "2025-12-09T10:30:00.000Z",
  "snapshotKey": "backups/{sessionId}/categorization-2025-12-09T10-30-00-000Z.json",
  "stats": { "totalDocuments": 8000, "categorizedCount": 5000, ... }
}
```

### POST /api/export-onedrive

```json
// Request
{ "sessionId": "uuid", "accessToken": "..." }

// Response (success)
{
  "success": true,
  "backup": {
    "snapshotAt": "2025-12-09T10:30:00.000Z",
    "r2CleanupScheduledAt": "2025-12-16T10:30:00.000Z",
    "r2RetentionDays": 7
  }
}

// Response (no snapshot)
{
  "error": "Snapshot required before export",
  "code": "SNAPSHOT_REQUIRED"
}
```

### POST /api/cleanup-session

```json
// Request (preview)
{ "sessionId": "uuid", "confirmDelete": false }

// Response (preview)
{
  "success": false,
  "preview": true,
  "message": "This will permanently delete...",
  "warning": "No categorization snapshot found..."
}

// Request (actual delete)
{ "sessionId": "uuid", "confirmDelete": true }
```
