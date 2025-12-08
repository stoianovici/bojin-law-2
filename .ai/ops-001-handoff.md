# OPS-001 Handoff Notes

## Issue Summary

**Title:** Communications page not loading emails
**Priority:** P0-Critical
**Status:** New

The /communications page is not displaying any emails despite authentication working correctly and the StartEmailSync mutation being called.

## Root Cause Analysis

### Primary Bug (Fix First)

**Email resolvers are not registered in the GraphQL server.**

Location: `services/gateway/src/graphql/server.ts`

The file imports `emailDraftingResolvers` (line ~46) but does NOT import or merge `emailResolvers` from `./resolvers/email.resolvers`. This means all email-related GraphQL operations silently fail:

- Query: `emails`, `emailThreads`, `emailThread`
- Mutation: `startEmailSync`, `assignEmailToCase`, `markEmailAsRead`, etc.
- Subscription: `emailReceived`, `emailSyncProgress`

### Secondary Bug (Fix After Primary)

**MS access token not passed through GraphQL context.**

When `startEmailSync` is called, the resolver at `email.resolvers.ts:253` checks:

```typescript
if (!user || !user.accessToken) {
  throw new GraphQLError('Authentication required with valid access token', ...);
}
```

But the context only provides `{id, firmId, role, email}` - no accessToken.

The access token extraction happens in the web app's GraphQL proxy (`apps/web/src/app/api/graphql/route.ts`) but it builds an `x-mock-user` header without including the token.

## Suggested Fix Steps

### Step 1: Register Email Resolvers

In `services/gateway/src/graphql/server.ts`:

1. Add import:

```typescript
import { emailResolvers } from './resolvers/email.resolvers';
```

2. Merge into resolvers (in the `makeExecutableSchema` call):

```typescript
Query: {
  ...emailResolvers.Query,
  // ...existing queries
},
Mutation: {
  ...emailResolvers.Mutation,
  // ...existing mutations
},
Subscription: {
  ...emailResolvers.Subscription,
  // ...existing subscriptions
}
```

### Step 2: Pass Access Token Through Context

1. In `apps/web/src/app/api/graphql/route.ts`, extract MS access token from session
2. Pass it to gateway via header (e.g., `x-ms-access-token`)
3. In `services/gateway/src/graphql/server.ts` context builder, extract and include in user object

## Files to Investigate

| File                                                        | Purpose                                            |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `services/gateway/src/graphql/server.ts`                    | GraphQL server setup - needs resolver registration |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts` | Email resolver implementations                     |
| `apps/web/src/app/api/graphql/route.ts`                     | GraphQL proxy - needs token pass-through           |
| `apps/web/src/hooks/useEmailSync.ts`                        | Frontend hooks (reference for API shape)           |

## Testing

After fix:

1. Navigate to /communications
2. Check browser Network tab for successful GraphQL responses
3. Verify emails load in the UI
4. Check console for any remaining errors

## Session History

- **2025-12-08:** Issue created, root cause identified via codebase exploration
