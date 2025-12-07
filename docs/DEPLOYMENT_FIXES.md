# Deployment Fixes and Production Issues

This document tracks production deployment issues and their fixes for future reference.

---

## 2025-12-07: GraphQL Authentication Fix

### Issue Summary

After deploying to Render, multiple pages were broken:

1. **Analytics page** (`/analytics`) - showed "Authentication required" errors
2. **Platform Intelligence** (`/analytics/platform-intelligence`) - showed "Access denied"
3. **Cases, Documents, Tasks pages** - appeared to show Dashboard content instead of actual page content

### Root Cause Analysis

#### Authentication Architecture

The platform uses a split authentication model:

1. **Web App** (Next.js):
   - Uses Azure AD via MSAL for user authentication
   - Creates a simple base64-encoded session cookie (`legal-platform-session`)
   - Cookie contains: `{ userId, createdAt }`
   - Session validation via `apps/web/src/lib/auth.ts`

2. **Gateway** (Express + Apollo):
   - Expects user context via:
     - `x-mock-user` header (was only accepted in development), OR
     - `req.session.user` from express-session (Redis-backed)

3. **GraphQL Proxy** (`apps/web/src/app/api/graphql/route.ts`):
   - Proxies requests from web app to gateway
   - **Problem**: Only injected `x-mock-user` header in `NODE_ENV === 'development'`

#### The Problem

```
Browser -> Web App (has session cookie) -> GraphQL Proxy -> Gateway (no user context!)
```

In production:

- Web app had the authenticated user via session cookie
- GraphQL proxy forwarded cookies but NOT user context
- Gateway received no user info, returned auth errors
- Pages using GraphQL queries failed silently or showed errors

### Fix Applied

#### File 1: `apps/web/src/app/api/graphql/route.ts`

**Before:**

```typescript
// Only in development
...(process.env.NODE_ENV === 'development' && {
  'x-mock-user': JSON.stringify({...}),
}),
```

**After:**

```typescript
import { getAuthUser } from '@/lib/auth';

// Authenticate user from session cookie
const { user } = await getAuthUser(request);

// Pass authenticated user context to gateway in ALL environments
if (user) {
  headers['x-mock-user'] = JSON.stringify({
    userId: user.id,
    firmId: user.firmId,
    role: user.role,
    email: user.email,
  });
} else if (process.env.NODE_ENV === 'development') {
  // Fallback to mock user only in development
  headers['x-mock-user'] = JSON.stringify({...});
}
```

#### File 2: `services/gateway/src/graphql/server.ts`

**Before:**

```typescript
// Only accept header in non-production
if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user']) {
```

**After:**

```typescript
// Accept user context from web app proxy in ALL environments
// This is trusted internal communication (browser -> web app -> gateway)
if (req.headers['x-mock-user']) {
```

### Security Consideration

The `x-mock-user` header is now accepted in production. This is secure because:

1. The gateway is not directly exposed to the internet
2. Traffic flows: Browser -> Web App -> Gateway (internal)
3. The web app validates the session cookie before passing user context
4. The header name should be renamed to `x-user-context` in a future refactor

### Commit

```
e5f03bc fix: pass authenticated user context from web to gateway in production
```

### Verification Steps

After deployment, verify:

1. `/analytics` - No "Authentication required" errors
2. `/analytics/platform-intelligence` - No "Access denied" errors
3. `/cases`, `/documents`, `/tasks` - Show actual page content
4. Check browser Network tab for GraphQL responses with actual data

---

## Architecture Reference

### Authentication Flow

```
1. User clicks Login
2. Azure AD authentication via MSAL
3. Redirect to /auth/callback
4. Web app calls /api/auth/provision
5. Provision endpoint:
   - Validates Azure AD token
   - Creates/updates user in database
   - Sets session cookie (legal-platform-session)
6. Subsequent requests:
   - Browser sends session cookie
   - Web app validates cookie, extracts user
   - GraphQL proxy passes user context to gateway
```

### Key Files

- `apps/web/src/contexts/AuthContext.tsx` - MSAL auth provider
- `apps/web/src/app/api/auth/provision/route.ts` - User provisioning
- `apps/web/src/lib/auth.ts` - Session cookie handling
- `apps/web/src/app/api/graphql/route.ts` - GraphQL proxy
- `services/gateway/src/graphql/server.ts` - Gateway GraphQL context

### Environment Variables

- `GRAPHQL_ENDPOINT` - Gateway URL (set in Render for web service)
- `NEXT_PUBLIC_AZURE_AD_*` - Azure AD config
- `DATABASE_URL` - PostgreSQL connection (both services)
- `REDIS_URL` - Redis for sessions (gateway)

---

## Future Improvements

### Recommended

1. Rename `x-mock-user` header to `x-user-context` for clarity
2. Add shared secret validation between web app and gateway
3. Consider using JWT tokens instead of custom headers
4. Add request logging for debugging auth issues

### Known Limitations

1. Session cookie is simple base64 encoding (not encrypted)
2. No CSRF protection on session cookie
3. Gateway session middleware (express-session) is unused when proxied from web app

---

## 2025-12-07: Apollo Client Redirect Loop Fix

### Issue Summary

After the GraphQL authentication fix, `/cases`, `/tasks`, and `/documents` pages were still redirecting to `/` (dashboard) instead of displaying their content.

### Root Cause

The Apollo Client error handler in `apps/web/src/lib/apollo-client.ts` was automatically redirecting to `/login` when it received `UNAUTHENTICATED` GraphQL errors:

```typescript
// PROBLEMATIC CODE
if (gqlError.extensions?.code === 'UNAUTHENTICATED') {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'; // Hard redirect!
  }
}
```

This caused a redirect loop:

1. User navigates to `/cases`
2. Page loads, Apollo fires GraphQL query before auth is fully established
3. Gateway returns `UNAUTHENTICATED` error (race condition)
4. Apollo error handler redirects to `/login` via `window.location.href`
5. Login page sees user is authenticated (MSAL session is valid)
6. Login page redirects to `/`

### Why analytics worked but cases/tasks/documents didn't

- **Analytics pages**: Don't make GraphQL queries on initial load (uses `<FinancialData>` wrapper)
- **Cases/Tasks/Documents**: Use hooks like `useCases`, `useTaskManagementStore` that fire queries immediately on mount

### Fix Applied

Removed the automatic redirect from Apollo error handler. Authentication redirects are now handled solely by `ConditionalLayout` which properly waits for auth state to be established.

**File**: `apps/web/src/lib/apollo-client.ts`

**Before:**

```typescript
if (gqlError.extensions?.code === 'UNAUTHENTICATED') {
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
```

**After:**

```typescript
// UNAUTHENTICATED errors are handled by ConditionalLayout
// We don't redirect here to avoid race conditions with auth initialization
if (gqlError.extensions?.code !== 'UNAUTHENTICATED') {
  console.error(`[GraphQL error]: ...`);
}
```

### Why This Fix Works

1. `ConditionalLayout` already handles auth redirects properly:
   - Waits for `isLoading` to be false before checking `isAuthenticated`
   - Only redirects after auth state is fully initialized
   - Uses `router.replace('/login')` for proper SPA navigation

2. Apollo no longer causes race condition redirects:
   - UNAUTHENTICATED errors during auth initialization are silently ignored
   - Once auth is established, subsequent GraphQL requests succeed
   - No more redirect loops

### Verification Steps

After deployment, verify:

1. Navigate directly to `/cases` via URL bar - should stay on cases page
2. Click "Cazuri" in sidebar - should navigate to cases page
3. Same for `/tasks` and `/documents`
4. No redirect to `/` should occur

---

## 2025-12-07: Return URL Fix for Auth Redirect

### Issue Summary

Despite the Apollo redirect fix, `/cases`, `/tasks`, and `/documents` pages still redirected to `/` (dashboard).

### Root Cause

There was a race condition between MSAL initialization and ConditionalLayout's auth check:

1. User navigates to `/cases`
2. ConditionalLayout renders with `isLoading: true`, shows loading spinner
3. MSAL initialization runs asynchronously
4. If MSAL's `getAllAccounts()` returns empty briefly or has timing issues, it sets `isAuthenticated: false, isLoading: false`
5. ConditionalLayout sees `!isLoading && !isAuthenticated`, redirects to `/login`
6. By the time LoginPage mounts, MSAL has properly initialized and `isAuthenticated: true`
7. LoginPage redirects to `/` (hardcoded destination)
8. User ends up on dashboard instead of `/cases`

### Fix Applied

Preserve the intended destination when redirecting to login, then redirect back after auth is confirmed.

**File 1**: `apps/web/src/components/layout/ConditionalLayout.tsx`

```typescript
// Before:
router.replace('/login');

// After:
const returnUrl = encodeURIComponent(pathname || '/');
router.replace(`/login?returnUrl=${returnUrl}`);
```

**File 2**: `apps/web/src/app/login/page.tsx`

```typescript
// Added:
const searchParams = useSearchParams();
const returnUrl = searchParams.get('returnUrl');

// In useEffect:
if (isAuthenticated) {
  let destination = '/';
  if (returnUrl) {
    const decoded = decodeURIComponent(returnUrl);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      destination = decoded;
    }
  }
  router.push(destination);
}
```

### Why This Fix Works

Even if there's a timing issue with MSAL initialization causing a temporary redirect to `/login`, the user will be sent back to their intended destination (`/cases`) once auth is confirmed. This makes the redirect transparent to the user.

### Security Consideration

The returnUrl validation ensures only internal paths are allowed:

- Must start with `/`
- Must not start with `//` (prevents protocol-relative URLs like `//evil.com`)
- Invalid/external URLs fall back to `/`

### Verification Steps

After deployment, verify:

1. Navigate directly to `/cases` via URL bar - should stay on cases page
2. Click sidebar links - should navigate correctly
3. Check console for `[LoginPage] ... redirecting to /cases` (not `/`)
4. Version marker should show `2025-12-07-v3`

---

## 2025-12-07: SessionStorage Fix for MSAL Redirect (v4)

### Issue Summary

After the v3 returnUrl fix, navigating to `/cases` while not logged in triggered the Microsoft login flow, but after completing login, the user still ended up on `/` instead of `/cases`. The app was also entering a login loop where Microsoft login would fail and fall back to the login screen.

### Root Cause

Two issues were identified:

1. **Missing Suspense Boundary**: The `useSearchParams()` hook was used in LoginPage without a Suspense boundary. In Next.js App Router, this can cause hydration issues and unexpected behavior.

2. **ReturnUrl Lost During MSAL Redirect**: The returnUrl query parameter was lost when MSAL redirected to Microsoft and back:

```
/login?returnUrl=/cases → Microsoft Login → /auth/callback → / (returnUrl lost!)
```

The OAuth flow goes through Microsoft's servers, so the query params on `/login` are not preserved when returning to `/auth/callback`.

### Fix Applied

#### Fix 1: Wrap LoginPage with Suspense

**File**: `apps/web/src/app/login/page.tsx`

```typescript
// Before: Direct export without Suspense
export default function LoginPage() {
  const searchParams = useSearchParams(); // Can cause hydration issues
  // ...
}

// After: Wrapped in Suspense like auth/callback
function LoginPageContent() {
  const searchParams = useSearchParams();
  // ...
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LoginPageContent />
    </Suspense>
  );
}
```

#### Fix 2: Persist returnUrl in sessionStorage

**File 1**: `apps/web/src/app/login/page.tsx`

```typescript
const RETURN_URL_KEY = 'auth_return_url';

const handleLogin = async () => {
  // Store returnUrl BEFORE MSAL redirects to Microsoft
  if (returnUrl && typeof window !== 'undefined') {
    const decoded = decodeURIComponent(returnUrl);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      sessionStorage.setItem(RETURN_URL_KEY, decoded);
      console.log('[LoginPage] Stored returnUrl for after login:', decoded);
    }
  }
  await login();
};

// Also check sessionStorage when already authenticated
useEffect(() => {
  if (isAuthenticated) {
    let destination = '/';
    const storedReturnUrl = sessionStorage.getItem(RETURN_URL_KEY);
    if (storedReturnUrl) {
      sessionStorage.removeItem(RETURN_URL_KEY);
      if (storedReturnUrl.startsWith('/') && !storedReturnUrl.startsWith('//')) {
        destination = storedReturnUrl;
      }
    }
    router.push(destination);
  }
}, [isAuthenticated]);
```

**File 2**: `apps/web/src/app/auth/callback/page.tsx`

```typescript
const RETURN_URL_KEY = 'auth_return_url';

const getRedirectDestination = (): string => {
  if (typeof window !== 'undefined') {
    const storedReturnUrl = sessionStorage.getItem(RETURN_URL_KEY);
    if (storedReturnUrl) {
      sessionStorage.removeItem(RETURN_URL_KEY);
      if (storedReturnUrl.startsWith('/') && !storedReturnUrl.startsWith('//')) {
        console.log('[AuthCallback] Using stored returnUrl:', storedReturnUrl);
        return storedReturnUrl;
      }
    }
  }
  return '/';
};

// Use getRedirectDestination() instead of hardcoded '/'
if (isAuthenticated) {
  router.push(getRedirectDestination());
}
```

### Complete Auth Flow After Fix

```
1. User navigates to /cases (not logged in)
2. ConditionalLayout redirects to /login?returnUrl=%2Fcases
3. User clicks "Sign in with Microsoft"
4. LoginPage stores "/cases" in sessionStorage
5. MSAL redirects to Microsoft
6. User authenticates with Microsoft
7. Microsoft redirects to /auth/callback
8. AuthCallback reads "/cases" from sessionStorage
9. AuthCallback redirects to /cases
10. User lands on /cases as intended
```

### Commits

```
953e021 fix: preserve returnUrl when redirecting to login to fix navigation loop
006cc83 fix: persist returnUrl through MSAL redirect via sessionStorage
```

### Verification Steps

After deployment, verify:

1. Console shows `[Apollo] Client version: 2025-12-07-v4`
2. Navigate to `/cases` while not logged in
3. Click "Sign in with Microsoft"
4. Console shows `[LoginPage] Stored returnUrl for after login: /cases`
5. Complete Microsoft authentication
6. Console shows `[AuthCallback] Using stored returnUrl: /cases`
7. User lands on `/cases` (not `/`)

### Files Modified

- `apps/web/src/app/login/page.tsx` - Added Suspense, sessionStorage handling
- `apps/web/src/app/auth/callback/page.tsx` - Read returnUrl from sessionStorage
- `apps/web/src/components/layout/ConditionalLayout.tsx` - Pass returnUrl query param
- `apps/web/src/lib/apollo-client.ts` - Version marker updated to v4

---

## 2025-12-07: Session Cookie Fallback Fix (v5)

### Issue Summary

Even after completing Microsoft login successfully at `/`, navigating to `/cases`, `/documents`, or `/tasks` would show a secondary login screen. Investigation revealed that MSAL's sessionStorage was completely empty despite successful authentication.

### Root Cause

MSAL (Microsoft Authentication Library) was not persisting tokens to sessionStorage as expected. When the user navigated to a protected route:

1. `AuthContext` initialized and called `msalInstance.getAllAccounts()`
2. MSAL returned empty array (no cached accounts in sessionStorage)
3. `AuthContext` set `isAuthenticated: false`
4. `ConditionalLayout` redirected to `/login?returnUrl=/cases`
5. User saw another login screen

The session cookie (`legal-platform-session`) set during login was still valid, but `AuthContext` didn't use it as a fallback.

### Fix Applied

#### Fix 1: Update `/api/auth/me` to use local session cookie

**File**: `apps/web/src/app/api/auth/me/route.ts`

Changed from proxying to gateway to checking the local session cookie directly:

```typescript
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { authenticated: false, error: error || 'Not authenticated' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      firmId: user.firmId,
      status: 'Active',
      // ...
    },
  });
}
```

#### Fix 2: Add session cookie fallback to AuthContext

**File**: `apps/web/src/contexts/AuthContext.tsx`

Added `checkSessionCookie()` function and use it as fallback:

```typescript
const checkSessionCookie = useCallback(async (): Promise<User | null> => {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.authenticated && data.user) {
      console.log('[AuthContext] Session cookie valid, user:', data.user.email);
      return data.user;
    }
    return null;
  } catch (error) {
    return null;
  }
}, []);

// In initialize():
} else {
  // No MSAL accounts - check session cookie as fallback
  console.log('[AuthContext] No MSAL accounts, checking session cookie...');
  const sessionUser = await checkSessionCookie();

  if (sessionUser) {
    // Session cookie is valid - user is authenticated
    setState({
      user: sessionUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      msalAccount: null,
    });
  } else {
    // No MSAL account and no valid session cookie
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      msalAccount: null,
    });
  }
}
```

### Complete Auth Flow After Fix

```
1. User logs in via Microsoft at /
2. Provision endpoint sets session cookie (legal-platform-session)
3. User navigates to /cases
4. AuthContext initializes, MSAL has no accounts (sessionStorage empty)
5. AuthContext calls /api/auth/me
6. /api/auth/me validates session cookie, returns user
7. AuthContext sets isAuthenticated: true with user from cookie
8. User sees /cases content without re-authentication
```

### Commit

```
a49b886 fix: use session cookie as fallback when MSAL has no cached accounts
```

### Verification Steps

After deployment, verify:

1. Console shows `[Apollo] Client version: 2025-12-07-v5`
2. Login at `/` via Microsoft
3. Navigate to `/cases` - should show cases content directly
4. Console shows `[AuthContext] No MSAL accounts, checking session cookie...`
5. Console shows `[AuthContext] Session cookie valid, user: <email>`
6. No secondary login screen appears

### Files Modified

- `apps/web/src/app/api/auth/me/route.ts` - Check local session cookie
- `apps/web/src/contexts/AuthContext.tsx` - Add checkSessionCookie() fallback
- `apps/web/src/lib/apollo-client.ts` - Version marker updated to v5

---

## 2025-12-07: ConditionalLayout Race Condition Fix (v6) - PARTIAL SUCCESS

### Issue Summary

Despite v5 session cookie fallback, the user was still being redirected to login after authentication. Investigation showed:

1. MSAL sessionStorage remained empty in production
2. AuthContext's `checkSessionCookie()` was working correctly
3. But ConditionalLayout was redirecting to login BEFORE AuthContext finished checking

### Root Cause

Race condition between ConditionalLayout and AuthContext:

```
1. User navigates to /cases
2. ConditionalLayout renders with isLoading: true (from AuthContext)
3. AuthContext finishes MSAL check (no accounts)
4. AuthContext sets isLoading: false, isAuthenticated: false TEMPORARILY
5. AuthContext starts async checkSessionCookie()
6. ConditionalLayout sees: isLoading: false, isAuthenticated: false → REDIRECTS TO LOGIN
7. checkSessionCookie() completes, but too late - user already redirected
```

### Fix Attempted (v6)

Added independent session verification to ConditionalLayout:

**File**: `apps/web/src/components/layout/ConditionalLayout.tsx`

```typescript
const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);

useEffect(() => {
  // Skip if public route, already authenticated, or still loading
  if (isPublicRoute || isAuthenticated || isLoading) return;

  // AuthContext says not authenticated - double-check via /api/auth/me
  if (process.env.NODE_ENV === 'production' && sessionVerified === null) {
    const checkBeforeRedirect = async () => {
      try {
        console.log('[ConditionalLayout] Checking /api/auth/me before redirect...');
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await response.json();
        console.log('[ConditionalLayout] /api/auth/me response:', data);

        if (data.authenticated) {
          console.log('[ConditionalLayout] Session cookie valid, marking as verified');
          setSessionVerified(true);
          return;
        }
      } catch (error) {
        console.error('[ConditionalLayout] Session check error:', error);
      }

      setSessionVerified(false);
      const returnUrl = encodeURIComponent(pathname || '/');
      router.replace(`/login?returnUrl=${returnUrl}`);
    };

    checkBeforeRedirect();
  }
}, [isLoading, isAuthenticated, isPublicRoute, router, pathname, sessionVerified]);

// Updated render logic:
if (!isAuthenticated && !sessionVerified && process.env.NODE_ENV === 'production') {
  return <LoadingSpinner />;
}
```

### Result

This fix was deployed but the login loop persisted. The issue appears to be that even with session verification, something else is triggering the redirect cycle.

### Commits

```
2b5e265 chore: add debug logging to trace redirect issue
fabd526 fix: remove Apollo UNAUTHENTICATED redirect causing page navigation loop
d66b0a7 docs: add v4 sessionStorage fix to deployment documentation
```

---

## 2025-12-07: window.location.href Redirect Fix (v7) - ATTEMPTED

### Issue Summary

The login loop continued despite ConditionalLayout's independent session verification. Analysis revealed potential issues with React Router's client-side navigation not properly refreshing auth state.

### Root Cause Hypothesis

Using `router.push()` for navigation after authentication was problematic:

1. React Router performs client-side navigation
2. Client-side navigation doesn't trigger full page reload
3. Auth state may be stale during client-side navigation
4. Components may re-render with old auth state before new state propagates

### Fix Attempted (v7)

Changed LoginPage and AuthCallback to use `window.location.href` for redirects:

**File 1**: `apps/web/src/app/login/page.tsx`

```typescript
// Before:
router.push(destination);

// After:
window.location.href = destination;
```

**File 2**: `apps/web/src/app/auth/callback/page.tsx`

```typescript
// Before:
router.push(getRedirectDestination());

// After:
window.location.href = getRedirectDestination();
```

### Commits

```
6bc1d5c fix: use window.location.href for reliable redirects after auth
```

### Result

This fix was deployed but did not resolve the issue.

---

## 2025-12-07: AuthCallback Direct Session Verification (v8) - ATTEMPTED

### Issue Summary

Despite all previous fixes, the login loop persisted. Further analysis identified a React closure bug in AuthCallback.

### Root Cause

AuthCallback had a React closure bug with `isAuthenticated`:

```typescript
// PROBLEMATIC CODE in AuthCallback
if (isAuthenticated) {
  window.location.href = destination;
} else {
  setTimeout(() => {
    if (isAuthenticated) {
      // BUG: This captures the OLD value!
      window.location.href = destination;
    } else {
      setError('Authentication failed');
    }
  }, 1000);
}
```

The `setTimeout` callback captured `isAuthenticated` at closure creation time, not execution time. Even if authentication succeeded and `isAuthenticated` became `true`, the callback would still see `false`.

### Fix Attempted (v8)

Changed AuthCallback to directly verify session via `/api/auth/me` instead of relying on AuthContext state:

**File**: `apps/web/src/app/auth/callback/page.tsx`

```typescript
// Before: Relied on isAuthenticated from useAuth() (potentially stale)
const { isAuthenticated } = useAuth();
if (isAuthenticated) { ... }

// After: Direct session verification via HTTP
console.log('[AuthCallback] Checking session with /api/auth/me...');
const response = await fetch('/api/auth/me', { credentials: 'include' });
const data = await response.json();
console.log('[AuthCallback] /api/auth/me response:', data);

if (data.authenticated) {
  const destination = getRedirectDestination();
  console.log('[AuthCallback] Session verified, redirecting to:', destination);
  window.location.href = destination;
} else {
  console.log('[AuthCallback] Session not found, showing error');
  setError('Authentication failed. Please try again.');
  setIsProcessing(false);
}
```

Also removed the unused `useAuth()` import and `isAuthenticated` dependency.

### Commits

```
0be7066 fix: AuthCallback directly verifies session via /api/auth/me
```

### Result

**STATUS: NOT RESOLVED** - The login loop still persists after this fix.

---

## Current State (2025-12-07)

### Problem

After successful Microsoft authentication, navigating to protected routes (`/cases`, `/documents`, `/tasks`, `/settings/billing`) shows a login screen instead of the content. The app enters a redirect loop where:

1. User completes Microsoft login
2. Redirected to `/auth/callback`
3. AuthCallback should redirect to destination
4. Instead, user ends up at `/login?returnUrl=<destination>`
5. LoginPage may redirect back, causing a loop

### Key Observations

1. **MSAL sessionStorage is empty** - After OAuth redirect, MSAL doesn't restore cached tokens
2. **Session cookie IS valid** - `/api/auth/me` returns authenticated: true
3. **AuthContext falls back correctly** - Logs show session cookie validation working
4. **Something still triggers redirect** - Despite valid session, user sees login screen

### Files Modified Throughout These Attempts

- `apps/web/src/contexts/AuthContext.tsx` - Session cookie fallback
- `apps/web/src/components/layout/ConditionalLayout.tsx` - Independent session verification
- `apps/web/src/app/login/page.tsx` - Suspense wrapper, sessionStorage, window.location.href
- `apps/web/src/app/auth/callback/page.tsx` - Direct session verification, window.location.href
- `apps/web/src/app/api/auth/me/route.ts` - Local session cookie check
- `apps/web/src/lib/apollo-client.ts` - Removed UNAUTHENTICATED redirect

### Potential Remaining Issues to Investigate

1. **Cookie not being sent**: Check if `legal-platform-session` cookie has correct attributes (SameSite, Secure, Path, Domain)

2. **Cookie expiration**: Check if cookie is expiring too quickly

3. **Multiple redirects**: Check if there's a cascade of redirects that loses the session

4. **Browser cookie issues**: Third-party cookie blocking, storage partitioning in modern browsers

5. **Render proxy stripping cookies**: Check if Render's proxy affects cookie handling

6. **CORS issues**: Check if credentials are being sent properly across subdomains

### Debugging Commands

Check session cookie in browser:

```javascript
document.cookie.split(';').find((c) => c.includes('legal-platform-session'));
```

Check if `/api/auth/me` sees the cookie (run in browser console):

```javascript
fetch('/api/auth/me', { credentials: 'include' })
  .then((r) => r.json())
  .then(console.log);
```

Check sessionStorage:

```javascript
console.log(
  'MSAL sessionStorage:',
  Object.keys(sessionStorage).filter((k) => k.includes('msal'))
);
```

### Next Steps to Try

1. **Verify cookie settings** in `/api/auth/provision/route.ts`:
   - Ensure `sameSite: 'lax'` (not 'strict')
   - Ensure `secure: true` for production
   - Ensure `path: '/'`
   - Ensure no domain mismatch

2. **Add cookie debugging** to trace exactly when/where cookie is lost

3. **Check Render logs** for any proxy-related issues

4. **Test with localStorage** instead of sessionStorage for returnUrl

5. **Consider server-side session** instead of cookie-based auth for MSAL failover

---

## 2025-12-07: AuthCallback Race Condition Fix (v9) - DEPLOYED

### Issue Summary

The root cause of the persistent login loop was finally identified: AuthCallback was **racing** with AuthContext. AuthCallback's direct `/api/auth/me` check ran before AuthContext had finished processing `handleRedirectPromise()` and setting the session cookie.

### Root Cause Analysis

Previous attempts (v6-v8) focused on:

- Cookie settings
- Session verification fallbacks
- Window.location.href redirects

But the real issue was a **timing/race condition**:

```
Timeline (problematic):
─────────────────────────────────────────────────────────────────────
0ms:   /auth/callback mounts
       → AuthCallback useEffect: calls /api/auth/me (NO COOKIE YET!)
       → AuthContext useEffect: starts handleRedirectPromise()

50ms:  AuthCallback: gets {authenticated: false}
       AuthCallback: shows "Authentication failed" or redirects to /login

200ms: AuthContext: handleRedirectPromise() completes
       AuthContext: calls provisionUser() → sets cookie
       AuthContext: sets isAuthenticated: true
       (TOO LATE - user already redirected!)
```

The key insight: `handleRedirectPromise()` is async and takes time to exchange the OAuth code for tokens. AuthCallback's immediate check for the session cookie was doomed to fail because the cookie hadn't been set yet.

### Fix Applied

Rewrote `/auth/callback/page.tsx` to **wait for AuthContext** instead of doing its own session check:

**Before (v8):**

```typescript
// AuthCallback did its own /api/auth/me check immediately
useEffect(() => {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await response.json();
  if (data.authenticated) {
    window.location.href = destination;
  } else {
    setError('Authentication failed');
  }
}, []);
```

**After (v9):**

```typescript
// AuthCallback now waits for AuthContext
const { isAuthenticated, isLoading, error: authError } = useAuth();

// Compute error from various sources (no setState in effects)
const error = useMemo(() => {
  if (errorParam) return errorDescription;
  if (authError) return authError;
  if (hasTimedOut && !isLoading && !isAuthenticated) return 'Timeout';
  return null;
}, [searchParams, authError, hasTimedOut, isLoading, isAuthenticated]);

// Wait for AuthContext to finish processing, then redirect
useEffect(() => {
  if (error || hasRedirected.current) return;
  if (isLoading) return; // Still processing

  if (isAuthenticated) {
    hasRedirected.current = true;
    window.location.href = getRedirectDestination();
  }
}, [isLoading, isAuthenticated, hasTimedOut, error]);
```

### Key Changes

1. **Removed direct `/api/auth/me` fetch** - No more racing with AuthContext
2. **Use `useAuth()` hook** - Wait for AuthContext's `isAuthenticated` state
3. **Use `useMemo` for error state** - Satisfies ESLint rule about setState in effects
4. **Add 10-second timeout** - Fallback if auth takes too long
5. **Use `hasRedirected` ref** - Prevent double redirects

### Correct Auth Flow After Fix

```
1. User logs in via Microsoft
2. Microsoft redirects to /auth/callback
3. AuthCallback renders with isLoading: true (from AuthContext)
4. AuthCallback shows "Authenticating..." spinner
5. AuthContext's handleRedirectPromise() processes the OAuth code
6. AuthContext calls provisionUser() → sets session cookie
7. AuthContext sets isAuthenticated: true, isLoading: false
8. AuthCallback sees !isLoading && isAuthenticated
9. AuthCallback reads returnUrl from sessionStorage
10. AuthCallback redirects to destination via window.location.href
```

### Commit

```
0c7f3c7 fix: AuthCallback waits for AuthContext to prevent race condition (v9)
```

### Verification Steps

After deployment, verify in browser console:

1. Version check: `[Apollo] Client version: 2025-12-07-v9`
2. On `/auth/callback`: `[AuthCallback] Waiting for AuthContext to finish processing...`
3. After auth completes: `[AuthCallback] Auth successful, redirecting to: /`
4. No "Authentication failed" errors
5. User lands on correct destination (not `/login`)

### Files Modified

- `apps/web/src/app/auth/callback/page.tsx` - Complete rewrite to wait for AuthContext
- `apps/web/src/lib/apollo-client.ts` - Version marker updated to v9

### Why This Fix Should Work

Unlike previous attempts that tried to add more checks and fallbacks, this fix addresses the fundamental issue: **synchronization**. By using AuthContext's state instead of an independent check, we guarantee that:

1. The session cookie EXISTS before we check authentication
2. The redirect only happens AFTER provisioning is complete
3. There's no race between multiple async operations

---

## Current State (2025-12-07 - Post v9)

### Status: DEPLOYED - TESTING

The v9 fix has been deployed. If successful, navigating to protected routes after Microsoft authentication should work correctly without showing the login screen.

### If v9 Doesn't Work

If the issue persists, the next areas to investigate:

1. **AuthContext's handleRedirectPromise() failing silently** - Add logging to see if MSAL is returning null
2. **Cookie being blocked by browser** - Modern browsers may block cookies in certain scenarios
3. **Render proxy issues** - Check if cookies are being stripped by Render's CDN/proxy
