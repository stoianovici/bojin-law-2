# Research: Team Chat Backend Implementation

**Status**: Complete
**Date**: 2026-01-02
**Input**: `brainstorm-team-chat.md`, `research-team-chat.md`
**Next step**: `/plan research-team-chat-backend`

---

## Context Summary

**Project**: bojin-law-2 (GraphQL gateway backend)
**Location**: `/Users/mio/Developer/bojin-law-2`
**Tech Stack**: Node.js, Express, Apollo Server 4, Prisma 5.22, PostgreSQL 16, Redis (ioredis 5.8.2)
**Frontend**: bojin-law-ui (Next.js 16, Apollo Client 4)

**Goal**: Implement backend infrastructure for real-time team chat:

- GraphQL mutations/queries for messages
- WebSocket support for real-time updates
- Ephemeral message storage (24-hour expiry)
- Presence tracking and typing indicators
- Daily cleanup worker

---

## Problem Statement

The frontend team chat UI (designed in `research-team-chat.md`) requires backend infrastructure:

1. Database schema for ephemeral messages
2. GraphQL API (queries, mutations, subscriptions)
3. WebSocket transport for real-time delivery
4. Redis PubSub for multi-instance scaling
5. Cleanup worker for expired messages

---

## Research Findings

### 1. WebSocket & Subscription Infrastructure

**Current State**: PARTIAL - Foundation exists, WebSocket server missing

| Component             | Status       | Details                    |
| --------------------- | ------------ | -------------------------- |
| graphql-subscriptions | ✅ Installed | v3.0.0 in gateway          |
| PubSub (in-memory)    | ✅ Working   | Used in email resolvers    |
| graphql-ws            | ❌ Missing   | Not installed              |
| ws                    | ❌ Missing   | Not installed              |
| WebSocket server      | ❌ Missing   | No WS transport configured |
| Apollo Server         | ⚠️ HTTP only | v4.12.2, no WS endpoint    |

**Existing Subscription Pattern** (`/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/resolvers/email.resolvers.ts`):

```typescript
import { PubSub } from 'graphql-subscriptions';

const EMAIL_RECEIVED = 'EMAIL_RECEIVED';
const pubsub = new PubSub();

// Subscription resolver
Subscription: {
  emailReceived: {
    subscribe: () => pubsub.asyncIterableIterator([EMAIL_RECEIVED]),
  },
}

// Publishing
pubsub.publish(EMAIL_RECEIVED, { emailReceived: email });
```

**Required Changes for WebSocket**:

_Backend packages to install:_

```bash
npm install graphql-ws ws @types/ws
```

_Server setup_ (`/Users/mio/Developer/bojin-law-2/services/gateway/src/index.ts`):

```typescript
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';

const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => ({
      user: extractUserFromConnectionParams(ctx.connectionParams),
    }),
  },
  wsServer
);
```

---

### 2. Prisma Schema Design

**Recommended Model** (following existing patterns):

```prisma
model TeamChatMessage {
  id        String   @id @default(uuid())
  firmId    String   @map("firm_id")
  authorId  String   @map("author_id")
  content   String   @db.Text
  parentId  String?  @map("parent_id")
  mentions  String[] @default([])

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  expiresAt DateTime @map("expires_at") @db.Timestamptz

  firm     Firm              @relation(fields: [firmId], references: [id], onDelete: Cascade)
  author   User              @relation("SentChatMessages", fields: [authorId], references: [id], onDelete: Cascade)
  parent   TeamChatMessage?  @relation("MessageThread", fields: [parentId], references: [id], onDelete: Cascade)
  replies  TeamChatMessage[] @relation("MessageThread")

  @@index([firmId, createdAt])
  @@index([authorId])
  @@index([parentId])
  @@index([expiresAt])
  @@map("team_chat_messages")
}
```

**Pattern Sources**:

- `AIResponseCache` (lines 1210-1226): `expiresAt` with index
- `CommunicationEntry` (lines 3499-3530): Threading with `parentId`
- `TaskComment` (lines 2482-2510): Mentions array, self-referencing relation

**Migration Command**:

```bash
cd /Users/mio/Developer/bojin-law-2/packages/database
npm run prisma:migrate
```

---

### 3. GraphQL Resolver Patterns

**Authentication Helper** (standard across all resolvers):

```typescript
function requireAuth(context: Context): NonNullable<Context['user']> {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}
```

**Context Type**:

```typescript
interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}
```

**Transaction Pattern** (for create with audit):

```typescript
const message = await prisma.$transaction(async (tx) => {
  const created = await tx.teamChatMessage.create({
    data: { firmId, authorId, content, expiresAt },
    include: { author: true },
  });

  // Optional: audit log
  await tx.auditLog.create({
    data: { action: 'CHAT_MESSAGE_SENT', userId: authorId },
  });

  return created;
});
```

**Pagination Pattern** (offset-based):

```typescript
const messages = await prisma.teamChatMessage.findMany({
  where: { firmId: user.firmId },
  take: Math.min(limit || 50, 100),
  skip: offset || 0,
  orderBy: { createdAt: 'desc' },
  include: { author: true },
});
```

---

### 4. Redis & PubSub Patterns

**Redis Configuration** (`/Users/mio/Developer/bojin-law-2/packages/database/src/redis.ts`):

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  lazyConnect: true,
});
```

**Presence Tracking** (existing pattern in `activity-notification.service.ts`):

```typescript
const ONLINE_USER_KEY_PREFIX = 'user-online:';
const ONLINE_TTL_SECONDS = 10 * 60; // 10 minutes

async markUserOnline(userId: string): Promise<void> {
  await redis.setex(`${ONLINE_USER_KEY_PREFIX}${userId}`, ONLINE_TTL_SECONDS, '1');
}

async isUserOnline(userId: string): Promise<boolean> {
  return (await redis.get(`${ONLINE_USER_KEY_PREFIX}${userId}`)) === '1';
}
```

**Typing Indicator Pattern** (recommended):

```typescript
const TYPING_PREFIX = 'chat:typing:';
const TYPING_TTL = 5; // 5 seconds

async setTyping(firmId: string, userId: string): Promise<void> {
  const key = `${TYPING_PREFIX}${firmId}`;
  await redis.zadd(key, Date.now(), userId);
  await redis.expire(key, TYPING_TTL);
}

async getTypingUsers(firmId: string): Promise<string[]> {
  const key = `${TYPING_PREFIX}${firmId}`;
  await redis.zremrangebyscore(key, '-inf', Date.now() - 5000);
  return redis.zrange(key, 0, -1);
}
```

**Redis PubSub for Multi-Instance** (recommended):

```typescript
// Separate clients for pub/sub
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = new Redis(process.env.REDIS_URL);

// Subscribe
subClient.subscribe(`chat:firm:${firmId}`);
subClient.on('message', (channel, message) => {
  const payload = JSON.parse(message);
  // Broadcast to WebSocket clients
});

// Publish
pubClient.publish(`chat:firm:${firmId}`, JSON.stringify(message));
```

---

### 5. Cleanup Worker Pattern

**Template** (from `suggestion-cleanup.worker.ts`):

```typescript
import * as cron from 'node-cron';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

const WORKER_NAME = 'chat-cleanup';
let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;

export function startChatCleanupWorker(): void {
  if (isRunning) return;

  const schedule = process.env.CHAT_CLEANUP_CRON || '0 2 * * *'; // 2 AM daily
  const timezone = process.env.CHAT_CLEANUP_TIMEZONE || 'Europe/Bucharest';

  cronJob = cron.schedule(schedule, () => runCleanup(), { timezone });
  isRunning = true;

  logger.info(`[${WORKER_NAME}] Started with schedule: ${schedule}`);
}

async function runCleanup(): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await prisma.teamChatMessage.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    logger.info(
      `[${WORKER_NAME}] Deleted ${result.count} expired messages in ${Date.now() - startTime}ms`
    );
  } catch (error) {
    logger.error(`[${WORKER_NAME}] Error:`, error);
  }
}

export function stopChatCleanupWorker(): void {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  isRunning = false;
}
```

**Registration** (in `/Users/mio/Developer/bojin-law-2/services/gateway/src/index.ts`):

```typescript
import { startChatCleanupWorker, stopChatCleanupWorker } from './workers/chat-cleanup.worker';

// In startServer():
startChatCleanupWorker();

// In graceful shutdown:
stopChatCleanupWorker();
```

---

## Patterns Discovered

### Error Codes (standard across resolvers)

| Code              | Usage                  |
| ----------------- | ---------------------- |
| `UNAUTHENTICATED` | User not logged in     |
| `FORBIDDEN`       | User lacks permission  |
| `NOT_FOUND`       | Resource doesn't exist |
| `BAD_USER_INPUT`  | Invalid input data     |

### Naming Conventions

- Tables: `snake_case` with `@@map()`
- Fields: `camelCase` in Prisma, `snake_case` in DB with `@map()`
- Indexes: Composite for query patterns (`[firmId, createdAt]`)
- Relations: Descriptive names (`SentChatMessages`, `MessageThread`)

### File Organization

```
services/gateway/src/
├── graphql/
│   ├── schema/
│   │   └── team-chat.graphql      # New schema file
│   └── resolvers/
│       └── team-chat.resolvers.ts # New resolvers
├── services/
│   └── team-chat.service.ts       # Business logic
└── workers/
    └── chat-cleanup.worker.ts     # Cleanup cron
```

---

## Implementation Recommendation

### Phase 1: Database & Basic API (No Real-Time)

1. Add `TeamChatMessage` model to Prisma schema
2. Run migration
3. Create GraphQL schema with queries/mutations
4. Create resolvers with authentication
5. Test with GraphQL playground

### Phase 2: Cleanup Worker

1. Create `chat-cleanup.worker.ts` following suggestion-cleanup pattern
2. Register in server startup/shutdown
3. Add environment variables for configuration

### Phase 3: WebSocket Transport

1. Install `graphql-ws` and `ws`
2. Add WebSocket server to `index.ts`
3. Configure Apollo Server with WS plugin
4. Add subscription resolvers

### Phase 4: Redis PubSub (Multi-Instance)

1. Create separate pub/sub Redis clients
2. Replace in-memory PubSub with Redis PubSub
3. Add typing indicator with sorted sets
4. Test across multiple server instances

---

## File Plan

| File                                                            | Action | Purpose                               |
| --------------------------------------------------------------- | ------ | ------------------------------------- |
| `packages/database/prisma/schema.prisma`                        | Modify | Add TeamChatMessage model             |
| `services/gateway/src/graphql/schema/team-chat.graphql`         | Create | GraphQL type definitions              |
| `services/gateway/src/graphql/resolvers/team-chat.resolvers.ts` | Create | Query/Mutation/Subscription resolvers |
| `services/gateway/src/services/team-chat.service.ts`            | Create | Business logic, PubSub helpers        |
| `services/gateway/src/workers/chat-cleanup.worker.ts`           | Create | Daily message cleanup                 |
| `services/gateway/src/index.ts`                                 | Modify | Add WebSocket server, register worker |
| `services/gateway/src/graphql/server.ts`                        | Modify | Add WS cleanup plugin                 |
| `services/gateway/package.json`                                 | Modify | Add graphql-ws, ws dependencies       |

---

## Constraints Found

1. **No WebSocket server** - Must add `graphql-ws` and configure WS transport
2. **In-memory PubSub** - Single instance only; need Redis PubSub for scaling
3. **Auth via headers** - WebSocket needs `connectionParams` authentication flow
4. **Presence is polling-based** - 10-minute TTL, not true real-time broadcast

---

## Risks

| Risk                  | Impact | Mitigation                                        |
| --------------------- | ------ | ------------------------------------------------- |
| WebSocket complexity  | High   | Start with polling fallback, add WS incrementally |
| Multi-instance PubSub | Medium | Use Redis PubSub from start                       |
| Message volume        | Low    | 24-hour expiry + pagination                       |
| Auth in WebSocket     | Medium | Extract from connectionParams, validate JWT       |

---

## Environment Variables

```env
# Team Chat Configuration
CHAT_MESSAGE_TTL_HOURS=24
CHAT_CLEANUP_CRON=0 2 * * *
CHAT_CLEANUP_TIMEZONE=Europe/Bucharest

# WebSocket (optional, defaults work)
WS_PATH=/graphql
WS_KEEPALIVE_MS=30000
```

---

## Reference Files

| Purpose              | File Path                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Subscription pattern | `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/resolvers/email.resolvers.ts` (lines 54-68, 3664-3674) |
| Schema extension     | `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/schema/email.graphql` (lines 1124-1139)                |
| Resolver auth        | `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/resolvers/case.resolvers.ts` (lines 40-78)             |
| Worker pattern       | `/Users/mio/Developer/bojin-law-2/services/gateway/src/workers/suggestion-cleanup.worker.ts`                          |
| Redis setup          | `/Users/mio/Developer/bojin-law-2/packages/database/src/redis.ts`                                                     |
| Presence tracking    | `/Users/mio/Developer/bojin-law-2/services/gateway/src/services/activity-notification.service.ts`                     |
| Server entry         | `/Users/mio/Developer/bojin-law-2/services/gateway/src/index.ts`                                                      |
| Prisma schema        | `/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma`                                             |

---

## Next Step

Start a new session and run:

```
/plan research-team-chat-backend
```
