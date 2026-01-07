# Research: Case Sync Progress Indicator

**Status**: Complete
**Date**: 2026-01-04
**Input**: `brainstorm-case-sync-progress.md`
**Next step**: `/plan research-case-sync-progress`

---

## Problem Statement

When a user creates a new case, email and document syncing happens in the background. The case appears in lists immediately but with empty content, leaving users confused about whether sync is in progress or something is broken. We need visual feedback to reassure users that processing is underway.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Show indeterminate progress bar | Animated stripe-style bar (not percentage-based) | Calms user without needing accurate progress tracking |
| Display in all case-related views | `/cases` list (card), `/emails` list, `/documents` list, case detail header | User should see sync status wherever they encounter the case |
| Auto-start sync on case creation | No manual trigger needed | Seamless UX, user expects it to "just work" |
| Run full processing pipeline | Email sync → attachment extraction → document triage → timeline building | All downstream processing should chain automatically |
| Inline error with retry | Show "Eroare sincronizare" message with retry button | User can take action without navigating elsewhere |

### Technical Decisions

| Decision | Details | Rationale |
|----------|---------|-----------|
| Add `syncStatus` field to Case | Enum: `PENDING`, `SYNCING`, `COMPLETED`, `FAILED` | Simple, queryable, no extra tables needed |
| Use polling for status updates | Frontend polls every ~5 seconds while status is `PENDING` or `SYNCING` | Simple to implement, good enough for "reassurance" UX goal |
| Stop polling when `COMPLETED` or `FAILED` | Only active cases poll | Avoid unnecessary load |

### UI Components

| Component | Location | Behavior |
|-----------|----------|----------|
| `CaseSyncProgress` | Inline in case cards/rows | Shows animated bar when syncing, error state with retry when failed |
| Progress bar style | Indeterminate (animated stripe) | Linear-inspired, subtle, not distracting |
| Romanian text | "Sincronizare în curs..." / "Eroare sincronizare" | Matches existing UI language |

### Out of Scope

- Detailed per-step progress (email vs documents vs summary)
- WebSocket/subscription-based real-time updates
- Sync job history/audit trail
- Manual sync trigger button (auto-start only)
- Notification when sync completes (inline status is sufficient)

---

## Research Findings

### Open Questions - Answered

| Question | Answer | Evidence |
|----------|--------|----------|
| What is the current case creation flow? Where would sync get triggered? | Case created via `createCase` mutation. Currently NO automatic sync is triggered - sync only starts when contacts are added to a case via `addCaseActor()`. | `services/gateway/src/graphql/resolvers/case.resolvers.ts:621-769` |
| What backend jobs/services currently handle email sync and document processing? | Multiple services: `EmailSyncService`, `HistoricalEmailSyncService`, `EmailCategorizationWorker`, `DocumentSyncWorker`, `EmailAttachmentService`. All use BullMQ for job queues. | See Existing Code Analysis below |
| How are processing steps chained today (if at all)? | Only partially chained: Email sync → Categorization (auto, every 5 min). Attachment extraction and document triage are NOT automatically triggered. | `services/gateway/src/workers/email-categorization.worker.ts:410` |
| Which GraphQL queries/mutations need to include `syncStatus`? | `GET_CASES`, `GET_CASE`, `SEARCH_CASES`, `CREATE_CASE`, `UPDATE_CASE` in `apps/web/src/graphql/`. Schema updates needed in `case.graphql`. | `apps/web/src/graphql/queries.ts`, `mutations.ts` |
| Where is the Case model defined (Prisma schema)? | `packages/database/prisma/schema.prisma` lines 504-603. No syncStatus field currently exists. Existing enums like `CaseStatus` provide the pattern. | `packages/database/prisma/schema.prisma:504-603` |

### Existing Code Analysis

| Category | Files | Notes |
|----------|-------|-------|
| **Reuse as-is** | `apps/web/src/components/admin/TemplateSyncStatus.tsx` | UI component for sync status badges with states: synced/syncing/error/needs-review. Can serve as reference. |
| **Reuse as-is** | `services/gateway/src/workers/historical-email-sync.worker.ts` | BullMQ worker pattern with job tracking. |
| **Reuse as-is** | `apps/web/src/hooks/useEmailSync.ts` | Hook pattern for managing sync state. |
| **Modify** | `packages/database/prisma/schema.prisma` | Add `CaseSyncStatus` enum and `syncStatus` field to Case model. |
| **Modify** | `services/gateway/src/graphql/schema/case.graphql` | Add `syncStatus` to Case type and `CaseSyncStatus` enum. |
| **Modify** | `apps/web/src/graphql/queries.ts` | Add `syncStatus` to GET_CASES, GET_CASE, SEARCH_CASES queries. |
| **Modify** | `apps/web/src/graphql/mutations.ts` | Add `syncStatus` to CREATE_CASE, UPDATE_CASE responses. |
| **Modify** | `services/gateway/src/graphql/resolvers/case.resolvers.ts` | Trigger sync on case creation, update syncStatus. |
| **Create new** | `apps/web/src/components/cases/CaseSyncProgress.tsx` | New UI component for inline sync progress indicator. |
| **Create new** | `apps/web/src/hooks/useCaseSyncStatus.ts` | Hook for polling case sync status. |
| **Create new** | `services/gateway/src/services/case-sync.service.ts` | Service to orchestrate case sync pipeline. |

### Patterns Discovered

**1. Enum Pattern in Prisma (schema.prisma:361-367)**
```prisma
enum CaseStatus {
  PendingApproval
  Active
  OnHold
  Closed
  Archived
}
```
Use PascalCase for enum values. Define enum before the model that uses it.

**2. BullMQ Worker Pattern (historical-email-sync.worker.ts)**
```typescript
export const historicalSyncQueue = new Queue<HistoricalSyncJobData>('historical-email-sync', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 }
  }
});
```

**3. Existing HistoricalEmailSyncJob Model (schema.prisma:1620-1638)**
```prisma
model HistoricalEmailSyncJob {
  id            String   @id @default(uuid())
  caseId        String   @map("case_id")
  status        HistoricalEmailSyncStatus @default(Pending)
  totalEmails   Int?     @map("total_emails")
  syncedEmails  Int      @default(0) @map("synced_emails")
  errorMessage  String?  @map("error_message")
  startedAt     DateTime? @map("started_at")
  completedAt   DateTime? @map("completed_at")
}
```
This provides a pattern for tracking async job progress.

**4. GraphQL Enum Pattern (email.graphql:238-247)**
```graphql
enum HistoricalEmailSyncStatusEnum {
  Pending
  InProgress
  Completed
  Failed
}
```

**5. Frontend Sync Status Hook (useEmailSync.ts)**
```typescript
export function useEmailSync() {
  const [syncStatus, setSyncStatus] = useState<EmailSyncStatus | null>(null);
  // Polling logic for status updates
  // Start/stop sync methods
  // Error handling
}
```

### Constraints Found

1. **No automatic sync on case creation** - Currently sync only triggers when contacts are added via `addCaseActor()`. Need to trigger sync in `createCase` resolver.

2. **Partially chained pipeline** - Email categorization runs automatically every 5 minutes, but attachment extraction requires manual trigger. Document triage has no automatic trigger.

3. **BullMQ for job queues** - All async jobs use BullMQ with Redis. Maintain this pattern for case sync jobs.

4. **Rate limiting** - Email sync respects Graph API limits (50 jobs/minute for historical sync). Case sync should not overwhelm these limits.

5. **Multi-database support** - The app supports three gateway modes (seed, real, production). Migrations must work across all.

---

## Implementation Recommendation

Based on research, the simplest approach that honors the decisions:

### 1. Database Layer
Add `syncStatus` field directly to Case model with `CaseSyncStatus` enum. Default to `PENDING` for new cases. This matches the decision to use a simple queryable field.

### 2. Backend Sync Trigger
Modify `createCase` resolver to:
1. Create the case with `syncStatus: PENDING`
2. Queue a new `case-sync` BullMQ job that orchestrates the full pipeline
3. Return the case immediately (non-blocking)

### 3. Case Sync Service (New)
Create a new service that:
1. Updates case to `syncStatus: SYNCING`
2. Chains existing services: Historical email sync → Email categorization → Attachment extraction
3. Updates case to `syncStatus: COMPLETED` or `FAILED`
4. Stores error message on failure

### 4. Frontend Polling
Create `useCaseSyncStatus` hook that:
1. Polls `GET_CASE` every 5 seconds when `syncStatus` is `PENDING` or `SYNCING`
2. Stops polling on `COMPLETED` or `FAILED`
3. Exposes `retryCaseSync` mutation for failures

### 5. UI Component
Create `CaseSyncProgress` component that:
1. Renders indeterminate progress bar for `SYNCING`
2. Renders error state with retry button for `FAILED`
3. Renders nothing for `COMPLETED`
4. Uses Romanian labels

---

## File Plan

| File | Action | Purpose | Maps to Decision |
|------|--------|---------|------------------|
| `packages/database/prisma/schema.prisma` | Modify | Add `CaseSyncStatus` enum and `syncStatus` field to Case | Add syncStatus field to Case |
| `services/gateway/src/graphql/schema/case.graphql` | Modify | Add `CaseSyncStatus` enum and `syncStatus` field | Add syncStatus field to Case |
| `services/gateway/src/graphql/schema/enums.graphql` | Modify | Add `CaseSyncStatus` enum | Add syncStatus field to Case |
| `apps/web/src/graphql/queries.ts` | Modify | Add `syncStatus` to case queries | Display in all case-related views |
| `apps/web/src/graphql/mutations.ts` | Modify | Add `syncStatus` to case mutation responses | Display in all case-related views |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts` | Modify | Trigger sync on case creation, return syncStatus | Auto-start sync on case creation |
| `services/gateway/src/services/case-sync.service.ts` | Create | Orchestrate full sync pipeline | Run full processing pipeline |
| `services/gateway/src/workers/case-sync.worker.ts` | Create | BullMQ worker for case sync jobs | Run full processing pipeline |
| `apps/web/src/hooks/useCaseSyncStatus.ts` | Create | Polling hook for sync status | Use polling for status updates |
| `apps/web/src/components/cases/CaseSyncProgress.tsx` | Create | UI component for sync indicator | Show indeterminate progress bar |
| `apps/web/src/components/cases/CaseCard.tsx` | Modify | Add CaseSyncProgress component | Display in /cases list |
| `apps/web/src/components/cases/CaseRow.tsx` | Modify | Add CaseSyncProgress component | Display in /cases list |
| `apps/web/src/components/cases/CaseDetailPanel.tsx` | Modify | Add CaseSyncProgress component | Display in case detail header |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Sync takes too long, user leaves before completion | Sync continues in background, status persists. User sees updated status on return. |
| Sync fails frequently, creating bad UX | Retry button allows user action. Log errors for debugging. Consider auto-retry with backoff. |
| Polling creates too many requests | 5-second interval is reasonable. Stop polling on completion. Consider increasing interval for older cases. |
| Historical email sync is slow (2 years of data) | Show indeterminate progress - user knows something is happening. Consider limiting initial sync scope. |
| Concurrent case creation overwhelms job queue | BullMQ has built-in concurrency controls. Historical sync already limited to 50 jobs/minute. |
| Migration fails on production data | Test migration on production backup first. Add field with default value for backwards compatibility. |

---

## Next Step

Start a new session and run:
`/plan research-case-sync-progress`
