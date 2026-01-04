# Plan: Global Settings Backend Implementation

**Status**: Approved
**Date**: 2026-01-02
**Input**: `research-global-settings.md`
**Next step**: `/implement plan-global-settings`

---

## Context Summary

**Project**: bojin-law-2 (backend monorepo)
**Path**: `/Users/mio/Developer/bojin-law-2`
**Tech Stack**: Node.js, TypeScript, Prisma, Apollo GraphQL, PostgreSQL
**Gateway**: `services/gateway/src/`

**Key Patterns**:

- Schema files: `src/graphql/schema/*.graphql`
- Resolvers: `src/graphql/resolvers/*.resolvers.ts`
- Services: `src/services/*.service.ts`
- Database: Prisma with `@legal-platform/database` package

---

## Approach Summary

The research identified 5 settings areas. Investigation revealed **3 already exist** with full GraphQL APIs:

| Feature          | Status  | Existing API                                                              |
| ---------------- | ------- | ------------------------------------------------------------------------- |
| Billing Rates    | ✅ Done | `defaultRates` query + `updateDefaultRates` mutation                      |
| Personal Emails  | ✅ Done | `personalContacts` query + `addPersonalContact`/`removePersonalContact`   |
| Courts           | ✅ Done | `globalEmailSources` query + CRUD mutations (filter by `category: Court`) |
| User Preferences | ⚠️ Need | GraphQL schema + resolver for `User.preferences` JSON field               |
| Team Access      | ⚠️ Need | GraphQL wrapper for existing `UserManagementService`                      |

**Remaining Work**: 2 GraphQL APIs to create.

---

## Parallel Group 1: GraphQL Schemas

> These tasks run simultaneously via sub-agents

### Task 1.1: Create User Preferences Schema

- **File**: `services/gateway/src/graphql/schema/user-preferences.graphql` (CREATE)
- **Do**:
  - Define `UserPreferences` type with `theme: Theme!` and `emailSignature: String`
  - Define `Theme` enum: `DARK`, `LIGHT`
  - Define `UpdateUserPreferencesInput` with optional `theme` and `emailSignature`
  - Add `userPreferences` query (returns current user's preferences)
  - Add `updateUserPreferences` mutation
- **Done when**: Schema file compiles without errors in GraphQL server

### Task 1.2: Create Team Access Schema

- **File**: `services/gateway/src/graphql/schema/team-access.graphql` (CREATE)
- **Do**:
  - Define `TeamMember` type (id, firstName, lastName, email, role, status)
  - Define `PendingUser` type (id, firstName, lastName, email, createdAt)
  - Define `ActivateUserInput` (firmId, role)
  - Add queries: `pendingUsers`, `teamMembers`
  - Add mutations: `activateUser`, `deactivateUser`, `updateTeamMemberRole`
  - Use `UserRole` enum (Partner, Associate, Paralegal, BusinessOwner)
- **Done when**: Schema file compiles without errors in GraphQL server

---

## Parallel Group 2: Resolvers

> These tasks run simultaneously via sub-agents

### Task 2.1: Create User Preferences Resolver

- **File**: `services/gateway/src/graphql/resolvers/user-preferences.resolvers.ts` (CREATE)
- **Do**:
  - Import prisma from `@legal-platform/database`
  - Implement `userPreferences` query:
    - Read `User.preferences` JSON field for current user
    - Return parsed preferences with defaults (theme: 'DARK', emailSignature: null)
  - Implement `updateUserPreferences` mutation:
    - Validate theme enum if provided
    - Merge input with existing preferences
    - Update `User.preferences` field
  - Follow existing resolver patterns (see `firm.resolvers.ts`)
- **Done when**: GraphQL playground returns valid responses

### Task 2.2: Create Team Access Resolver

- **File**: `services/gateway/src/graphql/resolvers/team-access.resolvers.ts` (CREATE)
- **Do**:
  - Import existing `UserManagementService` from `../../services/user-management.service`
  - Implement `pendingUsers` query → call `service.getPendingUsers()`
  - Implement `teamMembers` query → call `service.getActiveUsers(firmId)`
  - Implement `activateUser` mutation → call `service.activateUser()`
  - Implement `deactivateUser` mutation → call `service.deactivateUser()`
  - Implement `updateTeamMemberRole` mutation → call `service.updateUserRole()`
  - Add Partner role authorization check for all mutations
- **Done when**: GraphQL playground returns valid responses

---

## Sequential: After Group 2

### Task 3: Register Resolvers in Schema Index

- **Depends on**: Task 2.1, 2.2
- **File**: `services/gateway/src/graphql/schema/index.ts` (MODIFY)
- **Do**:
  - Import `user-preferences.graphql` schema
  - Import `team-access.graphql` schema
  - Import resolvers from new resolver files
  - Add to typeDefs array
  - Merge into resolvers object
- **Done when**: Server starts without errors, new queries appear in GraphQL playground

---

## Final Steps (Sequential)

### Task 4: Integration Testing

- **Depends on**: Task 3
- **Do**:
  - Start gateway server locally: `cd services/gateway && pnpm dev`
  - Test via GraphQL playground at `localhost:4000/graphql`:
    - Query `userPreferences` → returns theme and emailSignature
    - Mutation `updateUserPreferences` → updates and returns new values
    - Query `pendingUsers` → returns list (may be empty)
    - Query `teamMembers` → returns active users in firm
  - Verify existing APIs still work:
    - Query `defaultRates` → returns billing rates
    - Query `personalContacts` → returns blocklist
    - Query `globalEmailSources` → returns courts/authorities
- **Done when**: All queries/mutations return expected data, no errors

---

## Session Scope Assessment

- **Total tasks**: 4
- **Estimated complexity**: Simple-Medium
  - Task 1.1, 1.2: Simple (schema definition only)
  - Task 2.1: Simple (straightforward CRUD on User.preferences)
  - Task 2.2: Medium (wraps existing service, needs auth checks)
  - Task 3: Simple (import and register)
  - Task 4: Simple (manual verification)
- **Checkpoint recommended at**: Not needed (small scope)

---

## Files Summary

| File                                      | Action | Purpose                              |
| ----------------------------------------- | ------ | ------------------------------------ |
| `schema/user-preferences.graphql`         | CREATE | User preferences types + queries     |
| `schema/team-access.graphql`              | CREATE | Team management types + queries      |
| `resolvers/user-preferences.resolvers.ts` | CREATE | Preferences query/mutation logic     |
| `resolvers/team-access.resolvers.ts`      | CREATE | Team management via existing service |
| `schema/index.ts`                         | MODIFY | Register new schemas and resolvers   |

---

## Out of Scope (Already Working)

These features have full GraphQL APIs and require NO backend changes:

1. **Billing Rates**: `defaultRates` query + `updateDefaultRates` mutation in `firm.resolvers.ts`
2. **Personal Emails**: `personalContacts` query + mutations in `personal-contact.resolvers.ts`
3. **Courts/Authorities**: `globalEmailSources` query + CRUD in `global-email-sources.resolvers.ts`

Frontend should use these existing APIs directly.

---

## Next Step

Start a new session and run:

```
/implement plan-global-settings
```
