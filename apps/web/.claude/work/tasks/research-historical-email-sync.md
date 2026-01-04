# Research: Historical Email Sync for Cases

**Status**: Complete
**Date**: 2026-01-01
**Input**: `brainstorm-historical-email-sync.md`
**Next step**: `/plan research-historical-email-sync`

---

## Context Summary

**Project**: bojin-law-ui (Next.js 16, TypeScript, GraphQL via Apollo)
**Backend**: bojin-law-2 monorepo (gateway at localhost:4000)
**Auth**: Azure MSAL (Microsoft 365)
**Problem**: When cases are created with client contacts, historical email threads are not synced - only newly received emails.

**Decided Approach**: Background queue with progress tracking. Auto-sync for clients, manual for other roles (future).

---

## Research Findings

### 1. Current Email Sync Implementation

**Location**: `/services/gateway/src/services/email-sync.service.ts`

The system uses a **hybrid approach**:

- **Full Sync (Polling)**: Fetches all emails via `/me/messages` with pagination
- **Incremental Sync (Webhooks)**: MS Graph subscriptions notify of new/updated/deleted emails

**Key patterns**:

```typescript
// Pagination with @odata.nextLink
let response = await this.fetchAllEmailsPage(client, pageSize);
do {
  const messages = response.value as Message[];
  // Process batch...
  nextLink = response['@odata.nextLink'];
  if (nextLink) response = await this.fetchNextPage(client, nextLink);
} while (nextLink && emailsSynced < maxEmails);
```

**Deduplication**: Uses `graphMessageId` unique constraint - `createMany` skips existing records.

**Personal Contact Filtering**: Inbox emails from personal contacts are excluded.

### 2. Data Model - Email Ownership

**Critical Finding**: Emails support **many-to-many** relationship with cases via `EmailCaseLink`:

```prisma
model EmailCaseLink {
  id        String @id
  emailId   String
  caseId    String
  confidence Float?        // 0.0-1.0
  matchType  ClassificationMatchType?  // Actor, Manual, ThreadContinuity, etc.
  linkedBy   String        // "auto" or userId
  isPrimary  Boolean       // Original assignment

  @@unique([emailId, caseId])
}
```

**This answers the multi-case-per-client question**: Emails can be linked to multiple cases. When a client has Case A and Case B:

1. Historical emails are synced once (deduped by `graphMessageId`)
2. Each case gets its own `EmailCaseLink` record
3. No email duplication - just link records

**Contact Model**: Contacts are `CaseActor` entities scoped per case:

```prisma
model CaseActor {
  caseId    String
  role      CaseActorRole  // Client, OpposingParty, Court, etc.
  email     String?
  emailDomains String[]    // Additional domains for matching
}
```

### 3. Job Queue Infrastructure

**Technology**: BullMQ v5.65.0 + Redis (ioredis v5.8.2)

**Existing BullMQ Pattern** (from `document-sync.worker.ts`):

```typescript
const queue = new Queue<SyncJobData>('queue-name', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

const worker = new Worker('queue-name', processJob, {
  connection: redisConnection,
  concurrency: 5,
  limiter: { max: 100, duration: 60000 },
});
```

**23 existing workers** - most use cron-like `setInterval`, but `document-sync.worker.ts` uses BullMQ pattern which is ideal for our use case.

### 4. Neclar Queue (Unclear Emails)

**Classification States**:

- `Pending` - Just synced
- `Classified` - Assigned to case
- `Uncertain` - In NECLAR queue (needs review)
- `CourtUnassigned` - Court email, no case match
- `Ignored` - Not relevant

**Assignment Flow**:

1. User selects uncertain email
2. Clicks assign button with suggested case
3. `classifyUncertainEmail` mutation executes:
   - Updates `Email.caseId` and `classificationState = 'Classified'`
   - Creates `EmailCaseLink` record
   - Logs to `EmailClassificationLog`
   - Syncs to unified timeline

**Key Insight**: Assignment already creates `EmailCaseLink` - we can hook into this flow.

### 5. MS Graph API Patterns

**Email Fetching**:

```typescript
// Fetch with select fields
client
  .api('/me/messages')
  .select('id,conversationId,subject,body,from,toRecipients,...')
  .top(50)
  .get();
```

**Rate Limiting**:

- Global: 10,000 requests per 10 minutes
- Retry: Exponential backoff (1s → 32s), respects `Retry-After` header
- Circuit breaker: 10 consecutive failures → reject for 60s

**Historical Fetch by Sender**:

```typescript
// Filter by sender email address
client
  .api('/me/messages')
  .filter(`from/emailAddress/address eq '${emailAddress}'`)
  .top(50)
  .orderby('receivedDateTime desc')
  .get();
```

**Thread Fetch by Conversation ID**:

```typescript
// Get all emails in a conversation
client.api('/me/messages').filter(`conversationId eq '${conversationId}'`).get();
```

---

## Implementation Recommendation

### Approach: BullMQ Job Queue with Progress Tracking

**Trigger Points**:

1. `createCase` mutation - when client contact is added
2. `updateCase` mutation - when client contact is added
3. `classifyUncertainEmail` mutation - when email assigned from NECLAR

**Job Flow**:

```
Trigger → Queue Job → Worker Fetches Historical Emails → Link to Case → Update Progress
```

### Data Flow

1. **On Trigger**: Create `HistoricalEmailSyncJob` record in DB:

   ```typescript
   {
     id: uuid,
     caseId: string,
     contactEmail: string,
     contactRole: 'Client',
     status: 'pending' | 'in_progress' | 'completed' | 'failed',
     totalEmails: number | null,
     syncedEmails: number,
     errorMessage: string | null,
     startedAt: Date | null,
     completedAt: Date | null,
   }
   ```

2. **Queue Job**: Add to BullMQ with job data:

   ```typescript
   await historicalSyncQueue.add('sync-history', {
     jobId: syncJob.id,
     caseId,
     contactEmail,
     userId, // For Graph API token
   });
   ```

3. **Worker Process**:
   - Fetch emails from Graph API filtered by sender/recipient
   - Skip emails already synced (`graphMessageId` exists)
   - Create `EmailCaseLink` for each email
   - Update progress in `HistoricalEmailSyncJob`

4. **UI Polling**: Case Comms section polls job status:
   ```graphql
   query HistoricalSyncStatus($caseId: ID!) {
     historicalEmailSyncStatus(caseId: $caseId) {
       status
       totalEmails
       syncedEmails
       errorMessage
     }
   }
   ```

### Deduplication Strategy

Since emails can link to multiple cases:

1. Check if email exists by `graphMessageId`
2. If exists: Just create `EmailCaseLink` (no email re-fetch)
3. If not exists: Fetch from Graph, store email, create link

This handles the "same client, multiple cases" scenario efficiently.

---

## File Plan

| File                                                             | Action | Purpose                                                                 |
| ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                         | Modify | Add `HistoricalEmailSyncJob` model                                      |
| `services/gateway/src/workers/historical-email-sync.worker.ts`   | Create | BullMQ worker for sync jobs                                             |
| `services/gateway/src/services/historical-email-sync.service.ts` | Create | Sync logic, Graph API calls                                             |
| `services/gateway/src/graphql/schema/email.graphql`              | Modify | Add `historicalEmailSyncStatus` query, `triggerHistoricalSync` mutation |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts`      | Modify | Add resolver for sync status/trigger                                    |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts`       | Modify | Hook into `createCase`/`updateCase` for auto-trigger                    |
| `apps/web/src/components/communication/HistoricalSyncStatus.tsx` | Create | UI component showing sync progress                                      |
| `apps/web/src/app/.../case/[id]/communications/page.tsx`         | Modify | Integrate sync status component                                         |

---

## Patterns Discovered

### 1. Worker Pattern (from document-sync.worker.ts)

```typescript
export const historicalSyncQueue = new Queue<HistoricalSyncJobData>('historical-email-sync', {
  connection: redisConnection,
  defaultJobOptions,
});

export async function createHistoricalSyncWorker() {
  return new Worker('historical-email-sync', processJob, {
    connection: redisConnection,
    concurrency: 3, // Conservative for rate limits
    limiter: { max: 50, duration: 60000 },
  });
}
```

### 2. Graph API Pattern (from email-sync.service.ts)

```typescript
// Fetch by sender with pagination
async fetchEmailsByContact(client: Client, email: string) {
  let emails: Email[] = [];
  let response = await client.api('/me/messages')
    .filter(`from/emailAddress/address eq '${email}'`)
    .select(EMAIL_SELECT_FIELDS)
    .top(50)
    .orderby('receivedDateTime desc')
    .get();

  // Handle pagination with @odata.nextLink...
}
```

### 3. EmailCaseLink Creation (from email.resolvers.ts)

```typescript
await prisma.emailCaseLink.create({
  data: {
    emailId,
    caseId,
    confidence: 1.0,
    matchType: 'Manual',
    linkedBy: userId,
    isPrimary: false, // Historical sync is secondary
  },
});
```

---

## Risks

| Risk                    | Mitigation                                                                      |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Rate limiting**       | Conservative concurrency (3), respect Retry-After, use existing retry utilities |
| **Large email volumes** | Progress tracking, max limit per sync (configurable), pagination                |
| **Token expiration**    | Use existing `refreshAccessToken` pattern, refresh before Graph calls           |
| **Duplicate links**     | `@@unique([emailId, caseId])` constraint prevents duplicates                    |
| **User leaves page**    | Background job continues, status available on return                            |
| **Multiple triggers**   | Job deduplication by `caseId + contactEmail` composite key                      |

---

## Open Decisions for Planning

1. **Fetch strategy**: By sender email only, or also include emails TO the contact?
2. **Time limit**: Should we have a max age for historical emails (e.g., last 2 years)?
3. **Attachment handling**: Sync attachments during historical sync or lazy-load?

---

## Next Step

Start a new session and run:

```
/plan research-historical-email-sync
```
