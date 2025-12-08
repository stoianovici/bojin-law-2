# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> This file is the source of truth for all operations work across sessions.

## Quick Reference

| ID      | Title                                  | Type | Priority    | Status | Sessions |
| ------- | -------------------------------------- | ---- | ----------- | ------ | -------- |
| OPS-001 | Communications page not loading emails | Bug  | P0-Critical | New    | 1        |

<!-- Issues will be indexed here automatically -->

---

## Active Issues

### [OPS-001] Communications page not loading emails

| Field           | Value       |
| --------------- | ----------- |
| **Status**      | New         |
| **Type**        | Bug         |
| **Priority**    | P0-Critical |
| **Created**     | 2025-12-08  |
| **Sessions**    | 1           |
| **Last Active** | 2025-12-08  |

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

TBD

#### Session Log

- [2025-12-08] Issue created. Initial triage identified two critical bugs: (1) emailResolvers not merged into GraphQL server schema, (2) MS access token not passed through context.

#### Files Involved

- `services/gateway/src/graphql/server.ts` - Missing emailResolvers import/merge
- `services/gateway/src/graphql/resolvers/email.resolvers.ts` - Email resolver definitions
- `apps/web/src/hooks/useEmailSync.ts` - Frontend email hooks/queries
- `apps/web/src/components/email/EmailThreadList.tsx` - Email list component
- `apps/web/src/app/api/graphql/route.ts` - GraphQL proxy (missing access token pass-through)

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
