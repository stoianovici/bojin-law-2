# Plan: Historical Email Sync for Cases

**Status**: Approved
**Date**: 2026-01-01
**Input**: `research-historical-email-sync.md`
**Next step**: `/implement plan-historical-email-sync`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16, TypeScript, GraphQL via Apollo)
**Backend**: bojin-law-2 monorepo (gateway at localhost:4000)
**Tech**: BullMQ + Redis for job queue, MS Graph API for email fetching
**Pattern**: Existing `document-sync.worker.ts` provides BullMQ template

## Approach Summary

Build a background job system that syncs historical emails when clients are added to cases. When a case is created/updated with a client contact, a BullMQ job fetches emails from/to that contact (last 2 years), links them to the case via `EmailCaseLink`, and syncs attachments to the case's docs section. Progress is tracked in DB and shown in the UI.

## Design Decisions

| Decision        | Choice                       |
| --------------- | ---------------------------- |
| Fetch direction | Both FROM and TO the contact |
| Time limit      | Last 2 years                 |
| Attachments     | Sync to case's docs section  |

---

## Parallel Group 1: Foundation Layer

> Database model + Core service (no file overlap)

### Task 1.1: Add HistoricalEmailSyncJob Prisma Model

- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add `HistoricalEmailSyncJob` model:

  ```prisma
  model HistoricalEmailSyncJob {
    id            String   @id @default(uuid())
    caseId        String
    contactEmail  String
    contactRole   String   @default("Client")
    status        String   @default("pending")  // pending, in_progress, completed, failed
    totalEmails   Int?
    syncedEmails  Int      @default(0)
    errorMessage  String?
    startedAt     DateTime?
    completedAt   DateTime?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    case          Case     @relation(fields: [caseId], references: [id])

    @@unique([caseId, contactEmail])
    @@index([caseId])
    @@index([status])
  }
  ```

- **Done when**: `npx prisma validate` passes, migration generated

### Task 1.2: Create Historical Email Sync Service

- **File**: `services/gateway/src/services/historical-email-sync.service.ts` (CREATE)
- **Do**:
  - Implement `HistoricalEmailSyncService` class
  - `fetchEmailsByContact(client, email, since)` - Fetch emails FROM and TO contact within 2 years
  - `syncHistoricalEmails(jobId, caseId, contactEmail, userId)` - Main sync logic
  - Use existing Graph API patterns from `email-sync.service.ts`
  - Create `EmailCaseLink` for each email (skip if link exists)
  - Trigger attachment sync to docs section for each email
  - Update job progress after each batch
- **Done when**: Service compiles, exports main methods

---

## Sequential: After Group 1

### Task 2: Create BullMQ Worker

- **Depends on**: Task 1.1, Task 1.2
- **File**: `services/gateway/src/workers/historical-email-sync.worker.ts` (CREATE)
- **Do**:
  - Create `historicalSyncQueue` with BullMQ
  - Create worker with concurrency: 3, rate limiter: 50/min
  - Job processor calls `HistoricalEmailSyncService.syncHistoricalEmails`
  - Handle retries (3 attempts, exponential backoff)
  - Update job status on complete/fail
  - Export queue for use in resolvers
- **Done when**: Worker starts, logs ready message

---

## Parallel Group 2: GraphQL Layer

> Schema + Resolvers (resolvers only add new functions, no overlap risk)

### Task 3.1: Add GraphQL Schema

- **File**: `services/gateway/src/graphql/schema/email.graphql` (MODIFY)
- **Do**: Add types and operations:

  ```graphql
  type HistoricalEmailSyncStatus {
    id: ID!
    caseId: ID!
    contactEmail: String!
    status: String!
    totalEmails: Int
    syncedEmails: Int!
    errorMessage: String
    startedAt: DateTime
    completedAt: DateTime
  }

  extend type Query {
    historicalEmailSyncStatus(caseId: ID!): [HistoricalEmailSyncStatus!]!
  }

  extend type Mutation {
    triggerHistoricalEmailSync(caseId: ID!, contactEmail: String!): HistoricalEmailSyncStatus!
  }
  ```

- **Done when**: Schema validates with codegen

### Task 3.2: Add GraphQL Resolvers

- **File**: `services/gateway/src/graphql/resolvers/email.resolvers.ts` (MODIFY)
- **Do**:
  - Add `historicalEmailSyncStatus` query resolver - fetch jobs by caseId
  - Add `triggerHistoricalEmailSync` mutation resolver:
    - Create/update `HistoricalEmailSyncJob` record
    - Add job to `historicalSyncQueue`
    - Return job status
- **Done when**: Resolvers compile, basic query works

---

## Sequential: Auto-Trigger Integration

### Task 4: Hook into Case Mutations

- **Depends on**: Task 3.2
- **File**: `services/gateway/src/graphql/resolvers/case.resolvers.ts` (MODIFY)
- **Do**:
  - In `createCase`: After case created, if client contact has email, trigger sync
  - In `updateCase`: If client contact added/changed, trigger sync
  - Use `historicalSyncQueue.add()` directly
  - Skip if sync job already exists for this case+contact
- **Done when**: Creating case with client email triggers background job

---

## Parallel Group 3: UI Layer

> Component + Page (different files)

### Task 5.1: Create Sync Status Component

- **File**: `apps/web/src/components/communication/HistoricalSyncStatus.tsx` (CREATE)
- **Do**:
  - Create `HistoricalSyncStatus` component
  - Props: `caseId: string`
  - Query `historicalEmailSyncStatus` with polling (5s interval when in_progress)
  - Show progress bar with synced/total count
  - Show error state if failed
  - Hide when no active/recent sync jobs
- **Done when**: Component renders, shows mock progress

### Task 5.2: Integrate into Communications Page

- **File**: Find and modify the case communications page (MODIFY)
- **Do**:
  - Import `HistoricalSyncStatus` component
  - Add to top of communications section
  - Pass `caseId` from route params
- **Done when**: Sync status visible on communications page

---

## Final Steps (Sequential)

### Task 6: Integration Testing

- **Do**:
  - Start gateway with worker
  - Create case with client contact via GraphQL
  - Verify job created in DB
  - Verify worker processes job
  - Verify emails linked to case
  - Verify attachments in docs section
  - Verify UI shows progress
- **Done when**: End-to-end flow works

---

## Session Scope Assessment

- **Total tasks**: 8
- **Estimated complexity**: Medium
- **Checkpoint recommended**: After Task 4 (backend complete, can test before UI)

## Files Summary

| File                                                             | Action |
| ---------------------------------------------------------------- | ------ |
| `packages/database/prisma/schema.prisma`                         | MODIFY |
| `services/gateway/src/services/historical-email-sync.service.ts` | CREATE |
| `services/gateway/src/workers/historical-email-sync.worker.ts`   | CREATE |
| `services/gateway/src/graphql/schema/email.graphql`              | MODIFY |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts`      | MODIFY |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts`       | MODIFY |
| `apps/web/src/components/communication/HistoricalSyncStatus.tsx` | CREATE |
| Case communications page                                         | MODIFY |

---

## Next Step

Start a new session and run:

```
/implement plan-historical-email-sync
```
