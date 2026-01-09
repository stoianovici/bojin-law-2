# Handoff: [OPS-112] Apollo Client Missing x-ms-access-token Header

**Session**: 1
**Date**: 2025-12-23 16:15
**Status**: Fixing

## Issue Summary

Apollo client not passing `x-ms-access-token` header to GraphQL requests. Token exists in MSAL localStorage but `getMsAccessToken()` returns null due to race condition and MSAL cache miss.

## Fix Implemented

Added promise-based waiting mechanism in `apps/web/src/lib/apollo-client.ts`:

1. **Token getter ready signal** (lines 16-20): Promise that resolves when `setMsAccessTokenGetter` is called
2. **Wait function with timeout** (lines 87-101): `waitForTokenGetter()` races between getter ready and 3-second timeout
3. **Updated authLink** (lines 103-129): Now waits for token getter before attempting token acquisition

## Local Verification Status

| Step           | Status     | Notes |
| -------------- | ---------- | ----- |
| Prod data test | ⬜ Pending |       |
| Preflight      | ⬜ Pending |       |
| Docker test    | ⬜ Pending |       |

**Verified**: No

## Next Steps

1. Test with production data to verify fix resolves the race condition
2. Verify document preview works with the fix
3. Run preflight checks
4. Test in Docker environment

## Files Modified

- `apps/web/src/lib/apollo-client.ts` - Added waiting mechanism for token getter
