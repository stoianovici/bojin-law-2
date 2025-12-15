# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 9
**Date**: 2025-12-15 15:40
**Status**: Fixing (enhanced diagnostics deployed)

## Summary

- **Emails**: WORKING (23 imported, appear in Communications tab)
- **Attachments**: NOT WORKING - upgrade logic deployed but still showing 0

## ROOT CAUSE HYPOTHESIS

Attachments exist in `EmailAttachment` table (55 total across 9 emails) but they were synced BEFORE emails were linked to the case. Therefore:
- `EmailAttachment` records exist with `documentId = null`
- `Document` records do NOT exist
- `CaseDocument` records do NOT exist

The upgrade logic was added (commit `3ec7d36`) but it's not working. The most likely cause is that `email.caseId` is null when `syncAllAttachments` fetches the email, even though `updateMany` was called before.

## Session 9 Work

### Enhanced Diagnostics Added
Added two new diagnostic fields to `AttachmentSyncDetail`:
- `emailCaseId` - The email's caseId at time of sync (null if not linked)
- `upgradedWithDocument` - Counter for successfully upgraded attachments

Also added detailed logging at the upgrade decision point:
```
syncAllAttachments: Checking existing attachment for upgrade
- willUpgrade: !existing.documentId && !!email.caseId
```

**Commit**: `7ac1e5f` - Deploying to gateway now

### Deployment Status
- Gateway: Building (commit `7ac1e5f`)
- Web: Building

## How to Test

1. Go to email import wizard
2. Run an import with attachments enabled
3. Check browser console for `[useEmailImport] Import result:`
4. Expand `_debug.attachmentSyncDetails` array

Each entry now shows:
```javascript
{
  emailId: "...",
  graphMessageId: "...",
  attachmentsFromGraph: N,
  attachmentsSynced: N,
  attachmentsSkipped: N,
  attachmentsAlreadyExist: N,
  upgradedWithDocument: N,     // <-- NEW: How many upgraded
  emailCaseId: "..." | null,   // <-- NEW: Was email linked to case?
  errors: [...]
}
```

## Key Diagnostic Questions

1. **Is `emailCaseId` set or null?**
   - If null: The updateMany didn't commit before syncAllAttachments fetched the email
   - If set: The problem is elsewhere (Graph API or OneDrive)

2. **What is `willUpgrade` in Render logs?**
   - Look for: `syncAllAttachments: Checking existing attachment for upgrade`
   - If `willUpgrade: false` with `hasCaseId: false` → caseId timing issue
   - If `willUpgrade: true` but no upgrade → check for errors in sync

3. **Are there errors in the `errors` array?**
   - Graph API errors (token expired)
   - OneDrive errors (folder creation, upload)
   - Database errors (creating Document/CaseDocument)

## Files Modified This Session

- `services/gateway/src/services/email-attachment.service.ts` - Added emailCaseId to diagnostics, upgrade logging
- `services/gateway/src/services/email-to-case.service.ts` - Pass new diagnostic fields
- `services/gateway/src/graphql/schema/email-import.graphql` - New fields on AttachmentSyncDetail
- `apps/web/src/hooks/useEmailImport.ts` - Request new fields in GraphQL fragment

## Commits

1. Session 8: `3ec7d36` - fix(gateway): upgrade existing attachments without Document records
2. Session 9: `7ac1e5f` - feat(gateway): add emailCaseId diagnostic to attachment sync

## Next Steps If emailCaseId is null

If the diagnostic shows `emailCaseId: null` for all entries, the fix is to ensure the updateMany is committed before syncAllAttachments runs. Options:

1. **Use $transaction** - Wrap updateMany and subsequent operations in a transaction
2. **Re-fetch email in syncAllAttachments** - Already doing this, but maybe add a delay
3. **Pass caseId explicitly** - Instead of relying on the email's caseId, pass it from executeEmailImport

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# Check gateway logs on Render
# https://dashboard.render.com/ -> legal-platform-gateway -> Logs

# Test locally
pnpm dev
```
