# Handoff: [OPS-001] Communications page not loading emails

**Session**: 2
**Date**: 2025-12-08
**Status**: Fixing (code changes complete, ready for deployment)

## Work Completed This Session

### Fix 1: Register emailResolvers in GraphQL server

- Added import for `emailResolvers` in `services/gateway/src/graphql/server.ts`
- Merged email queries into Query resolvers (`emailResolvers.Query`)
- Merged email mutations into Mutation resolvers (`emailResolvers.Mutation`)
- Added Subscription resolvers (`emailResolvers.Subscription`)
- Added type resolvers: `Email`, `EmailThread`, `EmailAttachment`

### Fix 2: Pass MS access token through GraphQL context

- **Apollo Client** (`apps/web/src/lib/apollo-client.ts`):
  - Added `setContext` auth link to fetch and include MS access token as `x-ms-access-token` header
  - Created `setMsAccessTokenGetter()` function for AuthProvider to register token getter

- **AuthContext** (`apps/web/src/contexts/AuthContext.tsx`):
  - Added import for `setMsAccessTokenGetter`
  - Added useEffect to register `getAccessToken` function with Apollo client

- **GraphQL Proxy** (`apps/web/src/app/api/graphql/route.ts`):
  - Added code to forward `x-ms-access-token` header to gateway

- **Gateway Context** (`services/gateway/src/graphql/server.ts`):
  - Extract `x-ms-access-token` from request headers
  - Include `accessToken` in user context object

- **Context Type** (`services/gateway/src/graphql/resolvers/case.resolvers.ts`):
  - Added `accessToken?: string` to Context.user type definition

## Current State

All code changes are complete. The fix needs to be:

1. Committed to git
2. Deployed to production (Render)
3. Verified by testing /communications page

## Blockers/Questions

None - fix is ready for deployment.

## Next Steps

1. **Commit changes**: Run git add/commit with the changes
2. **Push to remote**: Push to trigger deployment
3. **Verify fix**:
   - Navigate to https://legal-platform-web.onrender.com/communications
   - Check browser Network tab for successful GraphQL responses
   - Verify emails load in the UI
   - Check console for any remaining errors
4. **Update status**: Change status to "Resolved" once verified

## Key Files Modified

| File                                                       | Change                                          |
| ---------------------------------------------------------- | ----------------------------------------------- |
| `services/gateway/src/graphql/server.ts`                   | Import + merge emailResolvers, extract MS token |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts` | Add accessToken to Context type                 |
| `apps/web/src/lib/apollo-client.ts`                        | Add auth link for MS token                      |
| `apps/web/src/contexts/AuthContext.tsx`                    | Register token getter with Apollo               |
| `apps/web/src/app/api/graphql/route.ts`                    | Forward x-ms-access-token header                |

## Testing Checklist

- [ ] Gateway builds without errors
- [ ] Web app builds without errors
- [ ] /communications page loads
- [ ] Email sync starts successfully
- [ ] Email threads are displayed
- [ ] No console errors related to email operations
