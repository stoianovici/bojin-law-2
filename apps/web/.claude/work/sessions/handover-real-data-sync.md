# Session Handover: Real MS 365 Data Sync

**Date**: 2024-12-31
**Status**: Debugging 400 error from gateway

---

## What Was Done

### Task: Enable MS 365 token flow to gateway

**Goal**: Send MS access tokens from UI to gateway so it can make Graph API calls for email sync.

### Changes Made

#### 1. `src/providers/AuthProvider.tsx`

- Added `setMsAccessTokenGetter()` initialization in `AuthInitializer` useEffect
- Created `getMsAccessToken()` function that:
  - Gets active MSAL account
  - Calls `acquireTokenSilent()` with mail scopes
  - Falls back to `acquireTokenPopup()` if interaction required
- Added console logging for debugging

#### 2. `src/lib/msal-config.ts`

- Added `Mail.ReadWrite` and `Mail.Send` to `loginRequest.scopes`
- Full scopes now: `Mail.Read`, `Mail.ReadBasic`, `Mail.ReadWrite`, `Mail.Send`

#### 3. `src/lib/apollo-client.ts`

- Added console logging to track token attachment

---

## Current State

### What's Working

- MS token getter is registered: `[Auth] MS token getter registered`
- Token acquisition succeeds: `[Auth] MS token acquired successfully`
- Header is attached: `[Apollo] Added x-ms-access-token header`

### What's Failing

- Gateway returns **400 Bad Request** on GraphQL requests
- Error details unknown - need to inspect response body

---

## Next Steps

1. **Get the actual error response** from the 400:
   - Open Chrome DevTools → Network tab
   - Click failed `graphql` request
   - Check Response tab for error JSON

2. **Possible causes**:
   - Gateway doesn't recognize the token format
   - GraphQL query/mutation has an issue
   - Header parsing problem on gateway side
   - CORS or content-type issue

3. **Check gateway logs** in bojin-law-2 terminal for more details

---

## Files to Review

| File                             | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| `src/providers/AuthProvider.tsx` | Token getter implementation (lines 69-108)  |
| `src/lib/apollo-client.ts`       | Token attachment in authLink (lines 87-102) |
| `src/lib/msal-config.ts`         | Mail scopes definition (line 56)            |

---

## MCP Setup

Chrome DevTools MCP was added:

```bash
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

To use it, start Chrome with:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

---

## Task Files

Archived in `.claude/work/tasks/done/`:

- `plan-real-data-sync.md`
- `research-real-data-sync.md`
- `brainstorm-real-data-sync.md`
- `implement-real-data-sync.md`
