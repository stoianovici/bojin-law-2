# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> This file is the source of truth for all operations work across sessions.

## Quick Reference

| ID      | Title                                  | Type        | Priority    | Status        | Sessions |
| ------- | -------------------------------------- | ----------- | ----------- | ------------- | -------- |
| OPS-001 | Communications page not loading emails | Bug         | P0-Critical | Investigating | 4        |
| OPS-002 | Legacy import stuck at 8k docs         | Performance | P1-High     | New           | 1        |

<!-- Issues will be indexed here automatically -->

---

## Active Issues

### [OPS-001] Communications page not loading emails

| Field           | Value         |
| --------------- | ------------- |
| **Status**      | Investigating |
| **Type**        | Bug           |
| **Priority**    | P0-Critical   |
| **Created**     | 2025-12-08    |
| **Sessions**    | 4             |
| **Last Active** | 2025-12-08    |

#### Description

The /communications page at https://legal-platform-web.onrender.com/communications is not loading actual emails. Console shows Apollo client working, MSAL auth succeeding, and MS access token being included for StartEmailSync - but no emails are displayed.

#### Reproduction Steps

1. Navigate to https://legal-platform-web.onrender.com/communications
2. Observe that no emails are loaded
3. Console shows StartEmailSync being called but no email data returned

#### Root Cause

**PRIMARY:** Email resolvers are NOT registered in the Apollo GraphQL server. The `emailResolvers` are defined in `services/gateway/src/graphql/resolvers/email.resolvers.ts` but are NOT imported or merged into `services/gateway/src/graphql/server.ts`. This causes all email-related GraphQL queries (emailThreads, emailThread, etc.) to fail silently.

**SECONDARY:** The GraphQL context does not include the MS access token. Even if resolvers were registered, `startEmailSync` would fail because the resolver expects `user.accessToken` but the context only provides `{id, firmId, role, email}`.

#### Fix Applied

**Fix 1: Register emailResolvers in GraphQL server**

- File: `services/gateway/src/graphql/server.ts`
- Added import: `import { emailResolvers } from './resolvers/email.resolvers';`
- Merged `emailResolvers.Query` into Query resolvers
- Merged `emailResolvers.Mutation` into Mutation resolvers
- Added `emailResolvers.Subscription` to Subscription resolvers
- Added type resolvers: `Email`, `EmailThread`, `EmailAttachment`

**Fix 2: Pass MS access token through GraphQL context**

- File: `apps/web/src/lib/apollo-client.ts` - Added auth link to include `x-ms-access-token` header
- File: `apps/web/src/contexts/AuthContext.tsx` - Register token getter with Apollo client
- File: `apps/web/src/app/api/graphql/route.ts` - Forward `x-ms-access-token` header to gateway
- File: `services/gateway/src/graphql/server.ts` - Extract token from header and add to context
- File: `services/gateway/src/graphql/resolvers/case.resolvers.ts` - Updated Context type to include `accessToken`

#### Session Log

- [2025-12-08] Issue created. Initial triage identified two critical bugs: (1) emailResolvers not merged into GraphQL server schema, (2) MS access token not passed through context.
- [2025-12-08] Session 2 started. Implemented both fixes: registered emailResolvers in server.ts and set up MS access token pass-through from client to gateway.
- [2025-12-08] Session 3 started. Continuing from: Fixing. Beginning verification of deployed fix.
- [2025-12-08] Session 3 - Found root cause: when user authenticated via session cookie only (no MSAL accounts cached), getAccessToken() returned null. Fixed by: (1) Enhanced getAccessToken to check for any MSAL accounts in browser, (2) Added hasMsalAccount and reconnectMicrosoft to AuthContext, (3) Updated EmailThreadList to show "Connect Microsoft" prompt when MSAL not available.
- [2025-12-08] Session 4 started. Problem persisting after previous fix. Re-investigating.
- [2025-12-08] Session 4 - Found root cause: `hasMsalAccount` was computed once at render time via `hasMsalAccount()` call, not as reactive state. When MSAL init completes with no accounts, the UI still showed "Sync" button because hasMsalAccount was evaluated before MSAL finished initializing. Fixed by: (1) Added `hasMsalAccountState` state variable, (2) Added `updateHasMsalAccount()` function called after MSAL init, (3) Changed context value to use state instead of computed function call.

#### Files Involved

- `services/gateway/src/graphql/server.ts` - **FIXED** - Added emailResolvers import/merge + token extraction
- `services/gateway/src/graphql/resolvers/email.resolvers.ts` - Email resolver definitions
- `services/gateway/src/graphql/resolvers/case.resolvers.ts` - **FIXED** - Added accessToken to Context type
- `apps/web/src/lib/apollo-client.ts` - **FIXED v14** - Added auth link for MS token, version bump
- `apps/web/src/contexts/AuthContext.tsx` - **FIXED v3** - Made hasMsalAccount reactive state instead of computed function
- `apps/web/src/app/api/graphql/route.ts` - **FIXED** - Forward x-ms-access-token header
- `apps/web/src/hooks/useEmailSync.ts` - Frontend email hooks/queries
- `apps/web/src/components/email/EmailThreadList.tsx` - **FIXED** - Added "Connect Microsoft" prompt when MSAL not available

---

### [OPS-002] Legacy import stuck at 8k docs

| Field           | Value                |
| --------------- | -------------------- |
| **Status**      | New                  |
| **Type**        | Performance          |
| **Priority**    | P1-High              |
| **Created**     | 2025-12-08           |
| **Sessions**    | 1                    |
| **Last Active** | 2025-12-08 19:45 UTC |

#### Description

Legacy document import process stalls/fails when processing approximately 8,000 documents. The system becomes unresponsive or times out when trying to load and process large document batches.

#### Reproduction Steps

1. Initiate legacy import with ~8,000+ documents
2. Observe import process stalling during batch loading phase
3. get-batch endpoint becomes slow/unresponsive

#### Root Cause

**PRIMARY (CRITICAL):** The `/api/get-batch` endpoint in `apps/legacy-import/src/app/api/get-batch/route.ts` has NO pagination - it fetches ALL documents for a user's batches in a single query. At 8K docs, this causes:

- Memory exhaustion from loading massive result sets
- Network payload too large (including extractedText field = 8-80MB transfer)
- PostgreSQL query timeouts

**SECONDARY:** Missing composite database indexes on `(sessionId, batchId)` causing slow queries.

**TERTIARY:** AI analysis limited to 100 docs per call (80+ API calls needed for 8K docs).

#### Fix Applied

TBD

#### Session Log

- [2025-12-08 19:45] Issue created. Initial triage identified critical pagination issue in get-batch endpoint. The endpoint loads ALL documents without pagination, and includes the large `extractedText` field unnecessarily.

#### Files Involved

- `apps/legacy-import/src/app/api/get-batch/route.ts` - **CRITICAL** - No pagination, includes extractedText
- `apps/legacy-import/src/app/api/analyze-documents/route.ts` - Batch size limited to 100
- `apps/legacy-import/src/app/api/extract-documents/route.ts` - Transaction handling
- `apps/legacy-import/src/services/ai-document-analyzer.ts` - BATCH_SIZE = 25
- `packages/database/prisma/schema.prisma` - Missing composite indexes

---

<!-- New issues are added here -->

---

## In Progress

<!-- Issues being actively worked move here -->

---

## Resolved

<!-- Completed issues move here with resolution notes -->

---

## Session History

| Date | Issue | Duration | Summary |
| ---- | ----- | -------- | ------- |

<!-- Session log entries -->
