# Plan: Team Chat Backend

**Status**: Approved
**Date**: 2026-01-02
**Input**: `research-team-chat-backend.md`
**Next step**: `/implement plan-team-chat-backend`

---

## Context Summary

**Project**: bojin-law-2 (GraphQL gateway backend)
**Location**: `/Users/mio/Developer/bojin-law-2`
**Tech Stack**: Node.js, Express, Apollo Server 4, Prisma 5.22, PostgreSQL 16, Redis (ioredis 5.8.2)

**Goal**: Implement real-time team chat backend with:

- GraphQL mutations/queries/subscriptions for messages
- WebSocket transport via graphql-ws
- Ephemeral messages (24-hour expiry)
- Presence tracking and typing indicators
- Daily cleanup worker

---

## Approach Summary

Add a `TeamChatMessage` model to Prisma with 24-hour expiry. Create GraphQL schema with queries (messages, typing users), mutations (send, delete, setTyping), and subscriptions (messageReceived). Implement WebSocket server using `graphql-ws` for real-time delivery. Use Redis sorted sets for typing indicators. Add a cron worker to clean expired messages daily at 2 AM.

---

## Parallel Group 1: Database & Dependencies

> These tasks run simultaneously via sub-agents

### Task 1.1: Add TeamChatMessage Prisma Model

- **File**: `/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add TeamChatMessage model at end of file with:
  - Fields: id (uuid), firmId, authorId, content (Text), parentId (optional), mentions (String[]), createdAt, expiresAt
  - Relations: firm → Firm, author → User ("SentChatMessages"), parent/replies self-relation ("MessageThread")
  - Indexes: [firmId, createdAt], [authorId], [parentId], [expiresAt]
  - Map to `team_chat_messages` table
- **Pattern**: Follow `AIResponseCache` for expiresAt, `CommunicationEntry` for threading
- **Done when**: Model compiles with `npx prisma validate`

### Task 1.2: Install WebSocket Dependencies

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/package.json` (MODIFY)
- **Do**: Run `npm install graphql-ws ws` and `npm install -D @types/ws` in gateway directory
- **Done when**: Dependencies appear in package.json, node_modules updated

---

## Sequential: After Group 1

### Task 2: Run Prisma Migration

- **Depends on**: Task 1.1
- **Directory**: `/Users/mio/Developer/bojin-law-2/packages/database`
- **Do**: Run `npx prisma migrate dev --name add_team_chat_message`
- **Done when**: Migration file created in `prisma/migrations/`, database updated

---

## Parallel Group 2: Core Chat Implementation

> These tasks run simultaneously via sub-agents

### Task 3.1: Create GraphQL Schema

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/schema/team-chat.graphql` (CREATE)
- **Do**: Define types and operations:

  ```graphql
  type TeamChatMessage {
    id: ID!
    content: String!
    author: User!
    parentId: ID
    mentions: [String!]!
    createdAt: DateTime!
    expiresAt: DateTime!
    replies: [TeamChatMessage!]!
  }

  type TypingUser {
    userId: String!
    userName: String!
  }

  extend type Query {
    teamChatMessages(limit: Int, offset: Int, parentId: ID): [TeamChatMessage!]!
    teamChatTypingUsers: [TypingUser!]!
  }

  extend type Mutation {
    sendTeamChatMessage(content: String!, parentId: ID, mentions: [String!]): TeamChatMessage!
    deleteTeamChatMessage(id: ID!): Boolean!
    setTeamChatTyping(isTyping: Boolean!): Boolean!
  }

  extend type Subscription {
    teamChatMessageReceived: TeamChatMessage!
    teamChatMessageDeleted: ID!
    teamChatTypingUpdated: [TypingUser!]!
  }
  ```

- **Pattern**: Follow `email.graphql` for subscription structure
- **Done when**: Schema parses without errors

### Task 3.2: Create Team Chat Service

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/services/team-chat.service.ts` (CREATE)
- **Do**: Implement service class with:
  - PubSub instance with event constants (MESSAGE_RECEIVED, MESSAGE_DELETED, TYPING_UPDATED)
  - `sendMessage(firmId, authorId, content, parentId?, mentions?)` - creates message, publishes event
  - `deleteMessage(id, userId)` - deletes if author, publishes event
  - `getMessages(firmId, limit, offset, parentId?)` - paginated query with author include
  - `setTyping(firmId, userId, userName, isTyping)` - Redis sorted set operations
  - `getTypingUsers(firmId)` - returns active typing users from Redis
  - Helper: calculate expiresAt as now + 24 hours
- **Pattern**: Follow `activity-notification.service.ts` for Redis patterns
- **Reference**: Redis client from `@legal-platform/database`
- **Done when**: All methods implemented, exports service singleton

### Task 3.3: Create Chat Cleanup Worker

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/workers/chat-cleanup.worker.ts` (CREATE)
- **Do**: Implement cron worker:
  - `startChatCleanupWorker()` - schedules cron at `CHAT_CLEANUP_CRON` (default: `0 2 * * *`)
  - `stopChatCleanupWorker()` - stops cron for graceful shutdown
  - `runCleanup()` - deletes messages where `expiresAt < now()`
  - Log deleted count and duration
- **Pattern**: Copy structure from `suggestion-cleanup.worker.ts`
- **Done when**: Worker exports start/stop functions, uses node-cron

---

## Sequential: Resolvers

### Task 4: Create Team Chat Resolvers

- **Depends on**: Task 3.1, 3.2
- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/resolvers/team-chat.resolvers.ts` (CREATE)
- **Do**: Implement resolvers:
  - `requireAuth(context)` helper - throws UNAUTHENTICATED if no user
  - Query.teamChatMessages - calls service.getMessages with user.firmId
  - Query.teamChatTypingUsers - calls service.getTypingUsers
  - Mutation.sendTeamChatMessage - calls service.sendMessage
  - Mutation.deleteTeamChatMessage - calls service.deleteMessage
  - Mutation.setTeamChatTyping - calls service.setTyping
  - Subscription.teamChatMessageReceived - filters by user.firmId
  - Subscription.teamChatMessageDeleted - filters by user.firmId
  - Subscription.teamChatTypingUpdated - filters by user.firmId
  - TeamChatMessage.replies resolver - lazy loads child messages
- **Pattern**: Follow `email.resolvers.ts` for subscription pattern
- **Done when**: All resolvers implemented, exports resolver map

---

## Parallel Group 3: Server Integration

> These tasks run simultaneously via sub-agents

### Task 5.1: Add WebSocket Server to Index

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/index.ts` (MODIFY)
- **Do**:
  1. Import WebSocketServer from 'ws', useServer from 'graphql-ws/lib/use/ws'
  2. Import chat cleanup worker start/stop functions
  3. After httpServer.listen(), create WebSocketServer on same server with path '/graphql'
  4. Call useServer() with schema and context extraction from connectionParams
  5. Add startChatCleanupWorker() call in server startup
  6. Add stopChatCleanupWorker() in graceful shutdown handler
- **Pattern**: See research doc section "WebSocket & Subscription Infrastructure"
- **Done when**: Server starts with WS endpoint at /graphql

### Task 5.2: Add WebSocket Cleanup Plugin

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/server.ts` (MODIFY)
- **Do**:
  1. Accept serverCleanup parameter (from useServer return value)
  2. Add ApolloServerPlugin for drainServer that calls serverCleanup.close()
  3. Export updated createApolloServer function signature
- **Pattern**: Apollo Server 4 plugin pattern
- **Done when**: Apollo server gracefully drains WebSocket connections

---

## Final Steps (Sequential)

### Task 6: Integration Testing

- **Depends on**: All previous tasks
- **Do**:
  1. Start the server: `npm run dev` in gateway
  2. Open GraphQL Playground at http://localhost:4000/graphql
  3. Test mutation: `sendTeamChatMessage(content: "Hello team!")`
  4. Test query: `teamChatMessages(limit: 10)`
  5. Verify message has expiresAt 24 hours from now
  6. Test subscription connection via WebSocket
- **Done when**: All operations work, no console errors

---

## Session Scope Assessment

- **Total tasks**: 9
- **Estimated complexity**: Medium
- **Checkpoint recommended at**: After Task 4 (before server integration changes)

## Environment Variables (add to .env)

```env
CHAT_MESSAGE_TTL_HOURS=24
CHAT_CLEANUP_CRON=0 2 * * *
CHAT_CLEANUP_TIMEZONE=Europe/Bucharest
```

## Reference Files

| Purpose              | File Path                                                        |
| -------------------- | ---------------------------------------------------------------- |
| Subscription pattern | `services/gateway/src/graphql/resolvers/email.resolvers.ts`      |
| Worker pattern       | `services/gateway/src/workers/suggestion-cleanup.worker.ts`      |
| Redis setup          | `packages/database/src/redis.ts`                                 |
| Presence tracking    | `services/gateway/src/services/activity-notification.service.ts` |
| Server entry         | `services/gateway/src/index.ts`                                  |

---

## Next Step

Start a new session and run:

```
/implement plan-team-chat-backend
```
