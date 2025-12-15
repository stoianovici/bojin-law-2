# Handoff: [OPS-024] Email Import - Attachments Not Importing

**Session**: 6
**Date**: 2025-12-15 10:55
**Status**: Root Cause Found

## Summary

- **Emails**: WORKING (23 emails imported, appear in Communications tab)
- **Attachments**: NOT WORKING (0 imported despite 9 detected in preview)
- **Root Cause**: MS access token is `null` when ExecuteEmailImport runs

## ROOT CAUSE IDENTIFIED

**The MS access token is `null` when the ExecuteEmailImport mutation runs.**

Console logs show:

```
[Apollo] Got MS access token for operation: ExecuteEmailImport token: null
```

The MSAL session has expired and silent token refresh fails with:

- `InteractionRequiredAuthError: AADSTS160021: Application requested a user session which does not exist`
- `BrowserAuthError: monitor_window_timeout: Token acquisition in iframe failed due to timeout`

The app falls back to session cookie auth (which works for platform features) but has no Graph API token for Microsoft operations like fetching attachment content from Outlook.

## Solution

User needs to re-authenticate with Microsoft to get fresh tokens:

1. Log out from the application
2. Log back in through the Microsoft authentication flow
3. Try the email import again

After re-authentication, the MSAL tokens will be refreshed and the ExecuteEmailImport mutation should receive a valid token.

## Work Completed This Session

1. Analyzed console logs from user's email import attempt
2. Identified that `[Apollo] Got MS access token for operation: ExecuteEmailImport token: null`
3. Found MSAL errors showing session expiration (`AADSTS160021`)
4. Documented root cause and solution
5. Updated issue status to "Root Cause Found"

## Previous Sessions Summary

### Session 5 (2025-12-15)

- Added diagnostic `_debug` field to `EmailImportResult`
- Added server-side logging for attachment import flow
- Added client-side console logging of import result

### Session 4 (2025-12-14)

- Fixed CaseDocument fields (linkedBy + firmId required)
- Fixed invalid DocumentStatus enum (ACTIVE → FINAL)

### Earlier Sessions

- Fixed Prisma JSON query issues
- Fixed timeline sync for emails
- Fixed Document fields for attachment import

## Next Steps

1. **Verify fix**: After user re-authenticates with Microsoft, test email import again
2. **If still failing**: Check server-side logs for attachment sync errors
3. **Consider UX improvement**: Add clear message when MSAL token is unavailable, prompting re-authentication

## Key Files

### Token handling:

- `apps/web/src/contexts/AuthContext.tsx` - MSAL authentication context
- `apps/web/src/lib/apollo-client.ts` - Apollo link that adds MS token to requests

### Attachment import:

- `services/gateway/src/services/email-attachment.service.ts` - Attachment sync logic
- `services/gateway/src/services/email-to-case.service.ts` - Email import orchestration

## Useful Commands

```bash
# Resume this issue
/ops-continue 024

# After fix is verified, close the issue
/ops-close 024
```
