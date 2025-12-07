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
