# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 10
**Date**: 2025-12-15 16:02
**Status**: Fixing (orphan detection deployed, awaiting verification)

## Summary

- **Emails**: WORKING (23 imported, appear in Communications tab)
- **Attachments**: FIX DEPLOYED - awaiting verification

## ROOT CAUSE IDENTIFIED

**EmailAttachment records have `documentId` set but the actual Document records don't exist (orphaned references).**

The previous upgrade logic only checked `if (!existing.documentId)`. But the diagnostic showed:

- `attachmentsAlreadyExist: 14` (attachments exist in DB)
- `upgradedWithDocument: 0` (none upgraded)
- `emailCaseId: "47504bff-..."` (caseId IS set)
- `errors: []` (no errors)

This means `documentId` was set on the EmailAttachment records, but pointing to non-existent Documents.

## Session 10 Fix

Modified the upgrade condition to check if Document actually exists:

```typescript
// OLD: Only checked if documentId was set
if (!existing.documentId && email.caseId) { ... }

// NEW: Check if Document actually exists
let documentExists = false;
if (existing.documentId) {
  const doc = await this.prisma.document.findUnique({
    where: { id: existing.documentId },
    select: { id: true },
  });
  documentExists = !!doc;
}
const needsUpgrade = !documentExists && !!email.caseId;
if (needsUpgrade) { ... }
```

Also added `orphanedDocumentIds` diagnostic field to track how many attachments have documentId pointing to non-existent Documents.

## Commits

- `26c6ca3` - fix(gateway): detect orphaned documentIds and upgrade attachments

## Deployment Status

- Gateway: Building (commit `26c6ca3`) - triggered at 15:00:57 UTC
- Web: Building (commit `26c6ca3`)

Check status:

```bash
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4pkv8q4i8rc73fq3mvg/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'
```

## How to Test

1. Wait for deployment to complete (should be live soon)
2. Go to email import wizard for case `47504bff-e466-4166-b6a6-16db23ebdb2d`
3. Run import with attachments enabled
4. Check console for `[useEmailImport] Import result:`
5. Expand `_debug.attachmentSyncDetails` array

New diagnostic fields:

```javascript
{
  attachmentsAlreadyExist: N,
  upgradedWithDocument: N,     // Should now be > 0
  orphanedDocumentIds: N,      // NEW: How many had orphaned documentId
  emailCaseId: "...",
  errors: [...]
}
```

## Expected Outcome

After fix:

- `orphanedDocumentIds` should show how many attachments had documentId pointing to non-existent Documents
- `upgradedWithDocument` should now be > 0 (attachments being upgraded)
- `attachmentsImported` at top level should be > 0
- Documents should appear in Documents panel

## Files Modified

- `services/gateway/src/services/email-attachment.service.ts` - Added orphan detection, new diagnostic field
- `services/gateway/src/services/email-to-case.service.ts` - Pass orphanedDocumentIds
- `services/gateway/src/graphql/schema/email-import.graphql` - Added orphanedDocumentIds field
- `apps/web/src/hooks/useEmailImport.ts` - Request orphanedDocumentIds in GraphQL

## If Fix Still Doesn't Work

If `upgradedWithDocument` is still 0 after this deploy:

1. Check `orphanedDocumentIds` - if > 0, orphan detection is working but upgrade is failing
2. Check `errors` array for upgrade errors (Graph API, OneDrive issues)
3. Check Render logs for detailed server-side logging

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# Check gateway deployment
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4pkv8q4i8rc73fq3mvg/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'

# Test locally
pnpm dev
```
