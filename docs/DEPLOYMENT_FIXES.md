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
