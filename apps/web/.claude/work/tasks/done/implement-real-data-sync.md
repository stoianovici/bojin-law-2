# Implementation: Real MS 365 Data Sync for Local Dev

**Status**: Complete
**Date**: 2024-12-31
**Input**: `plan-real-data-sync.md`
**Next step**: `/commit` or manual browser verification

---

## Summary

- [x] All code tasks completed
- [x] Type-check passing
- [ ] Manual browser verification required (see below)

## Files Changed

| File                           | Action   | Purpose                                                           |
| ------------------------------ | -------- | ----------------------------------------------------------------- |
| src/providers/AuthProvider.tsx | Modified | Added MS token getter initialization in AuthInitializer useEffect |
| src/lib/msal-config.ts         | Modified | Added `Mail.ReadWrite` and `Mail.Send` to login scopes            |

## Task Completion Log

- [x] Task 1.1: Initialize MS Token Getter in AuthProvider
  - Added imports for `setMsAccessTokenGetter` and `mailScopes`
  - Created `getMsAccessToken()` async function that acquires MS access token silently
  - Registered token getter with Apollo Client on mount
- [x] Task 1.2: Verify MSAL Login Scopes Include Mail Permissions
  - Added `Mail.ReadWrite` and `Mail.Send` to `loginRequest.scopes`
  - Full scopes now: `Mail.Read`, `Mail.ReadBasic`, `Mail.ReadWrite`, `Mail.Send`
- [x] Task 2: Manual verification step documented

## Implementation Details

### AuthProvider Changes

The `AuthInitializer` component now includes a useEffect that:

1. Creates a `getMsAccessToken()` function that:
   - Gets the active MSAL account (or first available account)
   - Calls `acquireTokenSilent()` with mail scopes
   - Returns the access token or null on failure
2. Registers this function with Apollo Client via `setMsAccessTokenGetter()`
3. Apollo's `authLink` will now include `x-ms-access-token` header in GraphQL requests

### MSAL Config Changes

Login request now requests all mail permissions upfront:

```typescript
scopes: [
  'openid',
  'profile',
  'email',
  'User.Read',
  'Mail.Read',
  'Mail.ReadBasic',
  'Mail.ReadWrite',
  'Mail.Send',
];
```

## Manual Verification Required

To verify the implementation works:

1. Start dev server: `npm run dev`
2. Open `http://localhost:3001`
3. Log in with MS 365 account (may need to re-consent for new scopes)
4. Open DevTools → Network tab
5. Trigger a GraphQL request
6. Verify `x-ms-access-token` header is present in request

## Issues Encountered

- ESLint config not set up in project (eslint.config.js missing) - not related to this change
- No blocking issues

## Next Step

Run `/commit` to commit changes, or verify in browser first.
