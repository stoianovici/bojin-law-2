# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 8
**Date**: 2025-12-15 15:20
**Status**: Fixing (upgrade logic deployed but not working yet)

## Summary

- **Emails**: WORKING (23 imported, appear in Communications tab)
- **Attachments**: PARTIALLY FIXED - root cause identified, fix deployed but still showing 0

## ROOT CAUSE IDENTIFIED & FIX ATTEMPTED

### The Problem
Attachments exist in `EmailAttachment` table (55 total across 9 emails) but they were synced BEFORE emails were linked to the case. Therefore:
- `EmailAttachment` records exist ✓
- `Document` records do NOT exist ✗
- `CaseDocument` records do NOT exist ✗

Without Document/CaseDocument records, attachments don't appear in the case's Documents panel.

### The Fix (Deployed but Not Working)
Added logic to `syncAllAttachments()` in `email-attachment.service.ts`:
- When existing attachment found WITHOUT `documentId`
- AND email now has `caseId`
- Re-download attachment from Graph API
- Store in OneDrive case folder
- Create Document + CaseDocument records
- Delete old EmailAttachment, keep new one with documentId

**Commit**: `3ec7d36` - Deployed to gateway

### Current Status
- Console diagnostic shows `attachmentSyncDetails` array with 9 entries
- But `attachmentsImported: 0` still shows in result
- UI shows "0 Atașamente"
- Documents panel is empty

## Next Steps

1. **Expand the `attachmentSyncDetails` array in console** to see per-email details:
   - Are there errors in any of the entries?
   - What are the `attachmentsFromGraph`, `attachmentsSynced`, `attachmentsAlreadyExist` values now?

2. **Check Render logs** for gateway service to see detailed error messages during the upgrade process. Look for:
   - `Existing attachment missing Document record, creating now`
   - `Successfully created Document for existing attachment`
   - `Failed to create Document for existing attachment`

3. **Possible issues to investigate**:
   - OneDrive folder creation might be failing
   - Graph API token might not have sufficient permissions for OneDrive write
   - Prisma transaction issues when deleting/creating EmailAttachment

4. **If upgrade is failing silently**, the fix logic might need error handling improvements or the OneDrive integration might need debugging.

## Key Files Modified This Session

### Console flooding fixes:
- `apps/web/src/components/email/EmailThreadView.tsx` - Added `sanitizeEmailHtml()` for cid: URLs
- `apps/web/src/components/communication/TimelineEntryCard.tsx` - Same fix
- `apps/web/src/components/ui/dialog.tsx` - Added `aria-describedby={undefined}`
- `apps/web/src/components/layout/ConditionalLayout.tsx` - Removed verbose auth logging

### Attachment diagnostic additions:
- `services/gateway/src/services/email-attachment.service.ts` - Added `_diagnostics` to result, upgrade logic for existing attachments
- `services/gateway/src/services/email-to-case.service.ts` - Added `attachmentSyncDetails` array to `_debug`
- `services/gateway/src/graphql/schema/email-import.graphql` - Added `AttachmentSyncDetail` type
- `apps/web/src/hooks/useEmailImport.ts` - Added new debug fields to fragment

## Commits This Session

1. `d0b1ca4` - fix(web): sanitize cid: image URLs in email HTML
2. `0256323` - fix(web): suppress DialogContent warnings and remove auth state logging
3. `228a915` - feat(gateway): add detailed attachment sync diagnostics
4. `3ec7d36` - fix(gateway): upgrade existing attachments without Document records

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# Check gateway logs on Render dashboard
# https://dashboard.render.com/ -> legal-platform-gateway -> Logs

# Test locally
pnpm dev
```

## Console Debug Data to Examine

When testing, expand the `_debug.attachmentSyncDetails` array. Each entry should show:
```javascript
{
  emailId: "...",
  graphMessageId: "...",
  attachmentsFromGraph: N,    // How many Graph API returned
  attachmentsSynced: N,       // How many were newly synced (including upgraded)
  attachmentsSkipped: N,      // Non-file types skipped
  attachmentsAlreadyExist: N, // Already had documentId
  errors: [...]               // <-- CHECK THIS FOR ERRORS
}
```

If `errors` array has entries, those explain why upgrade failed.
