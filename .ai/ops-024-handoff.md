# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 5
**Date**: 2025-12-15 09:30
**Status**: Investigating

## Summary

- **Emails**: WORKING (23 emails imported, appear in Communications tab)
- **Attachments**: NOT WORKING (0 imported despite 9 detected in preview)
- **Token**: Confirmed sent from frontend via Apollo logs

## Work Completed This Session

1. Verified Bug 6 fix deployed and live (`fef9f8f`)
2. Tested email import - emails work (23), attachments don't (0)
3. Confirmed MS access token IS being sent from frontend:
   ```
   [Apollo] Got MS access token for operation: ExecuteEmailImport token: eyJ0eXAiOiJKV1QiLCJu...
   ```
4. Added diagnostic `_debug` field to `EmailImportResult` (commits `1670257`, `9bb4d78`)
5. Added server-side logging throughout attachment import flow
6. Added client-side console logging of import result

## Diagnostic Infrastructure Added

### GraphQL `_debug` field:

```graphql
type EmailImportDebugInfo {
  hadAccessToken: Boolean!
  importAttachmentsRequested: Boolean!
  emailsWithAttachmentsCount: Int!
}
```

### Files modified:

- `services/gateway/src/graphql/resolvers/email-import.resolvers.ts` - Logger, diagnostic logging
- `services/gateway/src/services/email-to-case.service.ts` - `_debug` field, logging
- `services/gateway/src/graphql/schema/email-import.graphql` - `EmailImportDebugInfo` type
- `apps/web/src/hooks/useEmailImport.ts` - `_debug` in fragment, console logging

## Current State / Blockers

Need to see `_debug` values to determine root cause. User should expand the `[useEmailImport] Import result: Object` in browser console to see:

- `hadAccessToken` - Did token reach the server?
- `emailsWithAttachmentsCount` - Are emails marked with `hasAttachments=true`?

### Possible causes:

1. Database `has_attachments` field is false for emails that actually have attachments
2. Attachment sync failing silently (OneDrive API errors?)
3. Graph API returning empty attachment lists

## Next Steps

### 1. Get `_debug` values

Expand console Object to see diagnostic info.

### 2. Based on results:

- If `emailsWithAttachmentsCount = 0`:
  - Check how `hasAttachments` is populated during email sync
  - Look for email sync code that sets this field from Graph API

- If `emailsWithAttachmentsCount > 0` but 0 imported:
  - Check Render logs for attachment sync errors
  - May be OneDrive API failures

### 3. If `_debug` is null/undefined:

Web app might not have latest code deployed. Check/redeploy web service.

### 4. Alternative approach:

Add attachment sync errors to result.errors array for client visibility.

## Key Files

### Attachment sync logic:

- `services/gateway/src/services/email-attachment.service.ts`
  - `syncAllAttachments()` - Entry point
  - `syncAttachment()` - Per-attachment sync
  - `storeInOneDrive()` - Creates Document + CaseDocument

### Email sync (where hasAttachments comes from):

- Search for where emails are synced from Graph API to database
- Look for code setting `hasAttachments` or `has_attachments`

## All Commits This Issue

### Session 4 (2025-12-14)

1. `7b9ffb5` - fix: use logger instead of console.log in timeline sync
2. `3c11300` - fix: add required Document fields for email attachment import
3. `2e017e2` - fix: use valid DocumentStatus enum value (FINAL, not ACTIVE)
4. `fef9f8f` - fix: fix CaseDocument fields (linkedBy + firmId required)

### Session 5 (2025-12-15)

5. `1670257` - fix(gateway): add diagnostic logging for attachment import
6. `9bb4d78` - fix(gateway): add debug info to EmailImportResult for diagnosis

## Console Output to Look For

```
[useEmailImport] Import result: {
  success: true,
  emailsLinked: 23,
  attachmentsImported: 0,
  errors: [],
  _debug: {
    hadAccessToken: ???,              // KEY VALUE #1
    importAttachmentsRequested: true,
    emailsWithAttachmentsCount: ???   // KEY VALUE #2
  }
}
```

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# Deploy gateway
./scripts/render/deploy.sh gateway

# Check deployment status
curl -s -H "Authorization: Bearer rnd_xPmOVitvPACYNfeNEMSDH5ZQfSR0" \
  "https://api.render.com/v1/services/srv-d4pkv8q4i8rc73fq3mvg/deploys?limit=1" \
  | jq '.[0].deploy | {status, commit: .commit.id[0:7]}'

# Build gateway locally
pnpm --filter gateway build
```
