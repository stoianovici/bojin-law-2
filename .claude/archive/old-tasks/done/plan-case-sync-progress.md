# Plan: Case Sync Progress Indicator

**Status**: Approved
**Date**: 2026-01-04
**Input**: `research-case-sync-progress.md`
**Next step**: `/implement plan-case-sync-progress`

---

## Problem Statement

When a user creates a new case, email and document syncing happens in the background. The case appears in lists immediately but with empty content, leaving users confused about whether sync is in progress or something is broken. We need visual feedback to reassure users that processing is underway.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

### Functional Decisions

| Decision                          | Details                                                                     | Rationale                                                    |
| --------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Show indeterminate progress bar   | Animated stripe-style bar (not percentage-based)                            | Calms user without needing accurate progress tracking        |
| Display in all case-related views | `/cases` list (card), `/emails` list, `/documents` list, case detail header | User should see sync status wherever they encounter the case |
| Auto-start sync on case creation  | No manual trigger needed                                                    | Seamless UX, user expects it to "just work"                  |
| Run full processing pipeline      | Email sync → attachment extraction → document triage → timeline building    | All downstream processing should chain automatically         |
| Inline error with retry           | Show "Eroare sincronizare" message with retry button                        | User can take action without navigating elsewhere            |

### Technical Decisions

| Decision                                  | Details                                                                | Rationale                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| Add `syncStatus` field to Case            | Enum: `PENDING`, `SYNCING`, `COMPLETED`, `FAILED`                      | Simple, queryable, no extra tables needed                  |
| Use polling for status updates            | Frontend polls every ~5 seconds while status is `PENDING` or `SYNCING` | Simple to implement, good enough for "reassurance" UX goal |
| Stop polling when `COMPLETED` or `FAILED` | Only active cases poll                                                 | Avoid unnecessary load                                     |

### UI Components

| Component          | Location                                          | Behavior                                                            |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------- |
| `CaseSyncProgress` | Inline in case cards/rows                         | Shows animated bar when syncing, error state with retry when failed |
| Progress bar style | Indeterminate (animated stripe)                   | Linear-inspired, subtle, not distracting                            |
| Romanian text      | "Sincronizare în curs..." / "Eroare sincronizare" | Matches existing UI language                                        |

### Out of Scope

- Detailed per-step progress (email vs documents vs summary)
- WebSocket/subscription-based real-time updates
- Sync job history/audit trail
- Manual sync trigger button (auto-start only)
- Notification when sync completes (inline status is sufficient)

---

## Implementation Approach

Add a `syncStatus` enum field to the Case model (Prisma + GraphQL). Create a new `CaseSyncService` that orchestrates the full sync pipeline using BullMQ workers. Modify `createCase` resolver to trigger sync automatically. On the frontend, create a polling hook and `CaseSyncProgress` component that shows an indeterminate progress bar during sync and an error state with retry on failure. Integrate this component into CaseCard, CaseRow, and CaseDetailPanel.

---

## Tasks

### Parallel Group 1: Backend Foundation

> These tasks run simultaneously via sub-agents

#### Task 1.1: Add CaseSyncStatus enum and field to Prisma schema

- **Implements**: Add syncStatus field to Case
- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**:
  - Add `CaseSyncStatus` enum with values: `Pending`, `Syncing`, `Completed`, `Failed` (PascalCase per existing pattern)
  - Add `syncStatus CaseSyncStatus @default(Pending) @map("sync_status")` field to Case model
  - Add `syncError String? @map("sync_error")` field to store error messages on failure
- **Done when**: Schema compiles without errors

#### Task 1.2: Add CaseSyncStatus to GraphQL schema

- **Implements**: Add syncStatus field to Case
- **File**: `services/gateway/src/graphql/schema/case.graphql` (MODIFY)
- **Do**:
  - Add `enum CaseSyncStatus { Pending Syncing Completed Failed }`
  - Add `syncStatus: CaseSyncStatus` field to Case type
  - Add `syncError: String` field to Case type
- **Done when**: GraphQL schema is valid

#### Task 1.3: Create CaseSyncService

- **Implements**: Run full processing pipeline
- **File**: `services/gateway/src/services/case-sync.service.ts` (CREATE)
- **Do**:
  - Create singleton service following existing patterns
  - Implement `startCaseSync(caseId: string)` method that:
    1. Updates case to `syncStatus: Syncing`
    2. Queues historical email sync job
    3. Chains attachment extraction after email sync
    4. Updates case to `Completed` or `Failed` with error message
  - Implement `retryCaseSync(caseId: string)` for retry functionality
  - Use existing `HistoricalEmailSyncService` and `EmailAttachmentService`
- **Done when**: Service compiles and exports correctly

#### Task 1.4: Create CaseSyncWorker

- **Implements**: Run full processing pipeline
- **File**: `services/gateway/src/workers/case-sync.worker.ts` (CREATE)
- **Do**:
  - Create BullMQ queue `case-sync` following `historical-email-sync.worker.ts` pattern
  - Job data: `{ caseId: string }`
  - Default job options: 3 attempts, exponential backoff
  - Worker calls `CaseSyncService.startCaseSync()`
  - Export `caseSyncQueue` for use in resolvers
- **Done when**: Worker compiles and queue is properly configured

---

### Sequential: After Group 1

#### Task 2.1: Modify case resolvers to trigger sync

- **Implements**: Auto-start sync on case creation
- **Depends on**: Task 1.1, 1.2, 1.3, 1.4
- **File**: `services/gateway/src/graphql/resolvers/case.resolvers.ts` (MODIFY)
- **Do**:
  - In `createCase` mutation: queue case-sync job after case creation
  - Add `syncStatus` and `syncError` to Case resolver field selection
  - Add `retryCaseSync` mutation that calls `CaseSyncService.retryCaseSync()`
- **Done when**: New case creation triggers sync job, syncStatus is returned in queries

#### Task 2.2: Run database migration

- **Implements**: Add syncStatus field to Case
- **Depends on**: Task 1.1
- **File**: N/A (command)
- **Do**:
  - Run `pnpm --filter database exec prisma db push` for seed database
  - Run `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform pnpm --filter database exec prisma db push` for real database
  - Regenerate Prisma client
- **Done when**: Both databases have the new field, Prisma client is updated

---

### Parallel Group 2: Frontend Foundation

> These tasks run simultaneously via sub-agents

#### Task 3.1: Add syncStatus to GraphQL queries

- **Implements**: Display in all case-related views
- **File**: `apps/web/src/graphql/queries.ts` (MODIFY)
- **Do**:
  - Add `syncStatus` and `syncError` to `GET_CASES` query
  - Add `syncStatus` and `syncError` to `GET_CASE` query
  - Add `syncStatus` and `syncError` to `SEARCH_CASES` query
- **Done when**: All case queries include sync status fields

#### Task 3.2: Add syncStatus to GraphQL mutations

- **Implements**: Display in all case-related views
- **File**: `apps/web/src/graphql/mutations.ts` (MODIFY)
- **Do**:
  - Add `syncStatus` and `syncError` to `CREATE_CASE` mutation response
  - Add `syncStatus` and `syncError` to `UPDATE_CASE` mutation response
  - Add `RETRY_CASE_SYNC` mutation: `mutation RetryCaseSync($caseId: ID!) { retryCaseSync(caseId: $caseId) { id syncStatus syncError } }`
- **Done when**: Mutations include sync status in response

#### Task 3.3: Create useCaseSyncStatus hook

- **Implements**: Use polling for status updates, Stop polling when COMPLETED or FAILED
- **File**: `apps/web/src/hooks/useCaseSyncStatus.ts` (CREATE)
- **Do**:
  - Create hook that accepts `caseId` and `initialStatus`
  - Poll `GET_CASE` every 5 seconds when status is `Pending` or `Syncing`
  - Stop polling when status is `Completed` or `Failed`
  - Expose `retryCaseSync()` function using the retry mutation
  - Return `{ syncStatus, syncError, isPolling, retryCaseSync }`
- **Done when**: Hook correctly polls and stops on completion

#### Task 3.4: Create CaseSyncProgress component

- **Implements**: Show indeterminate progress bar, Inline error with retry
- **File**: `apps/web/src/components/cases/CaseSyncProgress.tsx` (CREATE)
- **Do**:
  - Accept props: `syncStatus`, `syncError`, `onRetry`
  - Render indeterminate animated progress bar when `Syncing` or `Pending`
  - Render error message "Eroare sincronizare" with retry button when `Failed`
  - Render nothing when `Completed`
  - Use Linear-inspired subtle animation (CSS keyframes for stripe effect)
  - Romanian text labels
- **Done when**: Component renders correctly for all states

---

### Parallel Group 3: UI Integration

> These tasks run simultaneously via sub-agents

#### Task 4.1: Add CaseSyncProgress to CaseCard

- **Implements**: Display in /cases list (card view)
- **File**: `apps/web/src/components/cases/CaseCard.tsx` (MODIFY)
- **Do**:
  - Import `CaseSyncProgress` component
  - Add `CaseSyncProgress` below case title when `syncStatus` is not `Completed`
  - Use `useCaseSyncStatus` hook for polling
- **Done when**: Sync progress shows in card view

#### Task 4.2: Add CaseSyncProgress to CaseRow

- **Implements**: Display in /cases list (row view)
- **File**: `apps/web/src/components/cases/CaseRow.tsx` (MODIFY)
- **Do**:
  - Import `CaseSyncProgress` component
  - Add `CaseSyncProgress` inline when `syncStatus` is not `Completed`
  - Use `useCaseSyncStatus` hook for polling
- **Done when**: Sync progress shows in row view

#### Task 4.3: Add CaseSyncProgress to CaseDetailPanel

- **Implements**: Display in case detail header
- **File**: `apps/web/src/components/cases/CaseDetailPanel.tsx` (MODIFY)
- **Do**:
  - Import `CaseSyncProgress` component
  - Add `CaseSyncProgress` in header section when `syncStatus` is not `Completed`
  - Use `useCaseSyncStatus` hook for polling
- **Done when**: Sync progress shows in detail view header

---

### Final: Integration & Verification

#### Task 5: Wire Together & Test

- **Depends on**: All above
- **Do**:
  - Create a new case and verify sync job is queued
  - Verify frontend shows sync progress
  - Verify polling stops when sync completes
  - Test retry functionality on simulated failure
  - Verify all case views show sync status
- **Done when**: Feature works end-to-end per Decisions

---

## Decision Coverage Check

| Decision                              | Implemented by Task(s)       |
| ------------------------------------- | ---------------------------- |
| Show indeterminate progress bar       | Task 3.4, 4.1, 4.2, 4.3      |
| Display in all case-related views     | Task 3.1, 3.2, 4.1, 4.2, 4.3 |
| Auto-start sync on case creation      | Task 2.1                     |
| Run full processing pipeline          | Task 1.3, 1.4, 2.1           |
| Inline error with retry               | Task 3.2, 3.3, 3.4           |
| Add syncStatus field to Case          | Task 1.1, 1.2                |
| Use polling for status updates        | Task 3.3                     |
| Stop polling when COMPLETED or FAILED | Task 3.3                     |

## Session Scope

- **Total tasks**: 12
- **Complexity**: Medium

---

## Next Step

Start a new session and run:
`/implement plan-case-sync-progress`
