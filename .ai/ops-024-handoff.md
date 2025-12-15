# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 11
**Date**: 2025-12-15 16:22
**Status**: Fixing (CaseDocument link fix deployed, awaiting verification)

## Summary

- **Emails**: WORKING (61 imported in last test)
- **Attachments**: FIX DEPLOYED - awaiting verification

## ROOT CAUSE IDENTIFIED (Session 11)

**Documents exist but CaseDocument links are missing.**

The diagnostic output from session 10 showed:

- `orphanedDocumentIds: 0` - Documents DO exist
- `upgradedWithDocument: 0` - No need to create new Documents
- `attachmentsAlreadyExist: 100+` - EmailAttachment records exist with documentId set

This means Documents were created previously, but they're not appearing in the Documents panel because **CaseDocument** records (which link Documents to Cases) don't exist for the current case.

## Session 11 Fix

Added logic to detect and create missing CaseDocument links:

```typescript
// If Document exists and email has caseId, check if CaseDocument exists
if (doc && email.caseId) {
  const caseDoc = await this.prisma.caseDocument.findFirst({
    where: {
      documentId: existing.documentId,
      caseId: email.caseId,
    },
  });

  // If Document exists but CaseDocument doesn't, create the link
  if (!caseDoc) {
    missingCaseDocument++;
    await this.prisma.caseDocument.create({
      data: {
        caseId: email.caseId,
        documentId: existing.documentId,
        linkedBy: email.userId,
        firmId: doc.firmId,
        isOriginal: true,
      },
    });
    linkedToCase++;
  }
}
```

New diagnostic fields added:

- `missingCaseDocument` - Documents that existed but had no CaseDocument for this case
- `linkedToCase` - Documents successfully linked to the case

## Commits

- `a478b86` - fix(gateway): create missing CaseDocument links for email attachments

## Deployment Status

- Gateway: Building (commit `a478b86`) - triggered at 16:22 UTC
- Web: Building (commit `a478b86`) - triggered at 16:22 UTC

Check status:

```bash
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4pkv8q4i8rc73fq3mvg/deploys?limit=1" \
  | jq '.[0] | {status: .deploy.status, commit: .deploy.commit.id[0:7]}'
```

## How to Test

1. Wait for deployment to complete
2. Go to email import wizard for case `47504bff-e466-4166-b6a6-16db23ebdb2d`
3. Run import with attachments enabled
4. Check console for `[useEmailImport] Import result:`
5. Expand `_debug.attachmentSyncDetails` array

New diagnostic fields to watch:

```javascript
{
  attachmentsAlreadyExist: N,
  upgradedWithDocument: N,
  orphanedDocumentIds: N,
  missingCaseDocument: N,    // NEW: Should be > 0 (Documents found without CaseDocument)
  linkedToCase: N,           // NEW: Should be > 0 (CaseDocument links created)
  emailCaseId: "...",
  errors: [...]
}
```

## Expected Outcome

After fix:

- `missingCaseDocument` should show how many Documents were missing CaseDocument links
- `linkedToCase` should show how many CaseDocument links were created
- Documents should now appear in Documents panel (via CaseDocument join)

## Files Modified

- `services/gateway/src/services/email-attachment.service.ts` - Added CaseDocument detection and creation
- `services/gateway/src/services/email-to-case.service.ts` - Pass new diagnostic fields
- `services/gateway/src/graphql/schema/email-import.graphql` - Added missingCaseDocument, linkedToCase fields
- `apps/web/src/hooks/useEmailImport.ts` - Request new diagnostic fields

## If Fix Still Doesn't Work

1. Check `missingCaseDocument` - if 0, Documents might already be linked to a different case
2. Check `errors` array for any CaseDocument creation errors
3. Check Render logs for detailed server-side logging
4. Verify Documents panel query includes the current caseId

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
