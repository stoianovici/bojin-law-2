# Handoff: [OPS-009] Multiple Re-login Prompts for Email/Attachments

**Session**: 2
**Date**: 2025-12-11
**Status**: Fixing (ready for deployment)

## Work Completed This Session

### Fix 1: MSAL Cache Persistence
- Changed `cacheLocation` from `sessionStorage` to `localStorage` in `msal-config.ts`
- This keeps MSAL tokens across browser sessions
- Previously: closing browser cleared tokens → user prompted to login again
- Now: tokens persist in localStorage → silent token refresh works

### Fix 2: Distinct Error Codes (Backend)
Added `MS_TOKEN_REQUIRED` error code to 6 email resolvers:
- `startEmailSync`
- `syncEmailAttachments`
- `emailAttachmentContent`
- `createEmailSubscription`
- `sendNewEmail`
- `replyToEmail`

Now the backend distinguishes between:
- `UNAUTHENTICATED` → Full login required (session expired)
- `MS_TOKEN_REQUIRED` → Only Microsoft reconnect needed (MSAL cache empty)

### Fix 3: Frontend Error Handling
- Apollo client error link dispatches `ms-token-required` custom event
- Communications page listens for this event
- Shows amber banner: "Reconectare Microsoft necesară" with "Reconectează" button
- User clicks button → MSAL silent SSO attempted, or redirect if needed

## Current State

- All fixes implemented and build verified
- **Ready for deployment**
- Need to deploy both web app and gateway service

## Testing After Deployment

1. **Test localStorage persistence:**
   - Log in to app
   - Close browser completely
   - Reopen and navigate to /communications
   - Should NOT prompt for login again

2. **Test MS_TOKEN_REQUIRED handling:**
   - Clear localStorage only (keep session cookie)
   - Navigate to /communications
   - Click "Sync Email"
   - Should see amber reconnect banner (not full login redirect)

3. **Test attachment download:**
   - With valid MSAL token: download should work
   - Without MSAL token: should show reconnect prompt

## Blockers/Questions

None - ready for deployment and testing.

## Next Steps

1. Commit and push changes
2. Deploy to production (gateway + web)
3. Test in production:
   - Verify localStorage persistence
   - Verify reconnect banner appears when MS token missing
   - Verify email sync works after reconnect
4. Update status to "Verifying" after deployment

## Key Files Changed

**Frontend:**
- `apps/web/src/lib/msal-config.ts` - localStorage cache
- `apps/web/src/lib/apollo-client.ts` - MS_TOKEN_REQUIRED event dispatch
- `apps/web/src/app/communications/page.tsx` - Reconnect banner UI

**Backend:**
- `services/gateway/src/graphql/resolvers/email.resolvers.ts` - MS_TOKEN_REQUIRED error code

## Commands to Deploy

```bash
# Commit changes
git add -A
git commit -m "fix(OPS-009): localStorage MSAL cache + MS_TOKEN_REQUIRED error handling"

# Push
git push origin main

# Deploy (if deploy hook configured)
pnpm deploy:production

# Or deploy via Render dashboard
```
