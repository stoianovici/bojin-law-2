# Plan: Real MS 365 Data Sync for Local Dev

**Status**: Approved
**Date**: 2024-12-31
**Input**: `research-real-data-sync.md`
**Next step**: `/implement plan-real-data-sync`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16 UI for Legal Platform V2)
**Location**: `~/Developer/bojin-law-ui`
**Related**: `~/Developer/bojin-law-2` (monorepo with backend services)

**Tech Stack**:

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Apollo Client 4 → connects to gateway at `localhost:4000/graphql`
- Azure MSAL Browser for auth
- Backend runs from bojin-law-2

**Key Files**:

- `src/providers/AuthProvider.tsx` - MSAL auth wrapper, manages login/tokens
- `src/lib/apollo-client.ts` - Apollo config with `setMsAccessTokenGetter()` (currently unused)
- `src/lib/msal-config.ts` - MSAL scopes and configuration
- `src/store/authStore.ts` - Zustand store for auth state

## Approach Summary

The MS 365 sync infrastructure already exists in bojin-law-2. The gap is that bojin-law-ui never sends MS access tokens to the gateway. We need to initialize `setMsAccessTokenGetter()` in AuthProvider so Apollo includes the `x-ms-access-token` header in GraphQL requests. This enables the gateway to use the token for Graph API calls.

---

## Parallel Group 1

> These tasks run simultaneously via sub-agents

### Task 1.1: Initialize MS Token Getter in AuthProvider

- **File**: `src/providers/AuthProvider.tsx` (MODIFY)
- **Do**:
  1. Import `setMsAccessTokenGetter` from `@/lib/apollo-client`
  2. Import `mailScopes` from `@/lib/msal-config`
  3. Create async function `getMsAccessToken()` that:
     - Gets active account from MSAL instance
     - Calls `instance.acquireTokenSilent()` with mail scopes
     - Returns the access token string (or null on failure)
  4. Call `setMsAccessTokenGetter(getMsAccessToken)` in `AuthInitializer` useEffect on mount
  5. Ensure this runs early, before GraphQL requests are made
- **Done when**: `setMsAccessTokenGetter` is called with a working token getter function

### Task 1.2: Verify MSAL Login Scopes Include Mail Permissions

- **File**: `src/lib/msal-config.ts` (MODIFY if needed)
- **Do**:
  1. Review `loginRequest.scopes` - currently has `Mail.Read`, `Mail.ReadBasic`
  2. Add `Mail.ReadWrite` and `Mail.Send` to login scopes for full sync capability
  3. Ensure scopes match what gateway expects for email sync operations
- **Done when**: Login scopes include all required mail permissions

---

## Sequential: After Group 1

### Task 2: Verify Token Flow in Browser

- **Depends on**: Task 1.1, 1.2
- **File**: N/A (manual testing)
- **Do**:
  1. Start bojin-law-ui: `npm run dev`
  2. Open browser to `http://localhost:3001`
  3. Log in with MS 365 account
  4. Open DevTools → Network tab
  5. Trigger a GraphQL request (navigate to a page that fetches data)
  6. Inspect request headers for `x-ms-access-token`
  7. Verify token is present and non-empty
- **Done when**: `x-ms-access-token` header visible in GraphQL requests with valid token

---

## Session Scope Assessment

- **Total tasks**: 3
- **Estimated complexity**: Simple
- **Checkpoint recommended at**: Not needed - single session task

## Next Step

Start a new session and run:

```
/implement plan-real-data-sync
```
