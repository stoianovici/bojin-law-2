# Research: Internal Team Chat in Activity Panel

**Status**: Complete
**Date**: 2026-01-02
**Input**: `brainstorm-team-chat.md`
**Next step**: `/plan research-team-chat`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Apollo Client 4, Zustand
**Backend**: bojin-law-2 (GraphQL gateway at localhost:4000)
**Design**: Linear-inspired dark theme

**Goal**: Add internal team chat to the "Activitate Echipa" (Team Activity) panel with:

- Stacked layout (collapsible activity feed + chat)
- iMessage-style messages (own = right, others = left)
- Real-time via WebSocket/GraphQL subscriptions
- Ephemeral messages (daily cleanup)
- Presence indicators (online/typing)

---

## Problem Statement

Add an internal team chat to the "Activitate Echipa" panel so team members can communicate in real-time alongside the activity feed. Chat should be simple, ephemeral (daily cleanup), and not distract from the activity log.

---

## Research Findings

### 1. GraphQL Subscriptions Infrastructure

**Backend Status**: PARTIAL - Foundation exists, WebSocket server missing

| Component             | Status    | Details                  |
| --------------------- | --------- | ------------------------ |
| graphql-subscriptions | Installed | v3.0.0 in gateway        |
| PubSub (in-memory)    | Working   | Used in email resolvers  |
| WebSocket server      | Missing   | No graphql-ws setup      |
| Apollo Server         | HTTP only | v4.12.2, no WS transport |

**Existing Subscription Example** (`/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/resolvers/email.resolvers.ts`):

```typescript
import { PubSub } from 'graphql-subscriptions';
const pubsub = new PubSub();

// Publishing events
pubsub.publish('EMAIL_RECEIVED', { emailReceived: email });

// Subscription resolver
Subscription: {
  emailReceived: {
    subscribe: () => pubsub.asyncIterator(['EMAIL_RECEIVED']),
  },
}
```

**Frontend Status**: No subscription support

- Apollo Client is HTTP-only (`/Users/mio/Developer/bojin-law-ui/src/lib/apollo-client.ts`)
- No WebSocket link configured
- No graphql-ws dependency

**Changes Required for Real-Time**:

_Backend_:

1. Install: `npm install graphql-ws ws @types/ws`
2. Add WebSocket server in `/Users/mio/Developer/bojin-law-2/services/gateway/src/index.ts`
3. Configure `graphql-ws` with auth context from connection params
4. Consider Redis PubSub for multi-instance support

_Frontend_:

1. Install: `npm install graphql-ws`
2. Update `/Users/mio/Developer/bojin-law-ui/src/lib/apollo-client.ts`:
   - Add WebSocketLink from `@apollo/client/link/ws`
   - Use split() to route subscriptions to WS, queries to HTTP
   - Pass auth in connectionParams

---

### 2. Team Activity Component Structure

**Component Found**: YES - Fully functional

| File                                                                          | Purpose                          |
| ----------------------------------------------------------------------------- | -------------------------------- |
| `/Users/mio/Developer/bojin-law-ui/src/components/tasks/TeamActivityFeed.tsx` | Main feed (210 lines)            |
| `/Users/mio/Developer/bojin-law-ui/src/components/layout/ContextPanel.tsx`    | Container with header (82 lines) |
| `/Users/mio/Developer/bojin-law-ui/src/components/layout/AppShell.tsx`        | Shows/hides panel                |

**Activity Data Structure**:

```typescript
interface Activity {
  id: string;
  type: 'subtask_completed' | 'status_changed' | 'task_created' | 'comment_added' | 'task_assigned';
  author: { id: string; firstName: string; lastName: string };
  timestamp: string;
  task?: { id: string; title: string };
  comment?: string;
  change?: { from: string; to: string };
  assignee?: { id: string; firstName: string; lastName: string };
}
```

**Current Layout**:

- ContextPanel width: 320px (w-80) or 384px (xl:w-96)
- Uses `flex-1 overflow-y-auto` for scrolling
- Mock data in ContextPanel (ready for API integration)

**Avatar Gradient System** (reuse for chat):

```typescript
const avatarGradients: Record<string, string> = {
  ab: 'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  mp: 'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  ed: 'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  ai: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
  cv: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
};
```

---

### 3. User Authentication & Identity

**Auth Flow**: Azure MSAL -> x-mock-user header -> GraphQL context

**Frontend User Access**:

```typescript
// Option 1: useAuth hook (recommended)
import { useAuth } from '@/hooks/useAuth';
const { user } = useAuth();
// user = { id, email, name, role, firmId }

// Option 2: Zustand store directly
import { useAuthStore } from '@/store/authStore';
const user = useAuthStore((state) => state.user);
```

**User Object Shape**:

```typescript
interface User {
  id: string; // UUID
  email: string; // user@example.com
  name: string; // Full name
  role: UserRole; // 'ADMIN' | 'LAWYER' | 'PARALEGAL' | 'SECRETARY'
  firmId: string; // UUID
}
```

**Backend GraphQL Context**:

```typescript
// Available in all resolvers via context.user
interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
    accessToken?: string;
  };
}
```

**Database User Model** (`/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma`):

```prisma
model User {
  id          String     @id @default(uuid())
  firmId      String?
  email       String     @unique
  firstName   String
  lastName    String
  role        UserRole
  status      UserStatus
  azureAdId   String     @unique
  lastActive  DateTime   @default(now())
}
```

---

### 4. Presence Tracking

**Backend Implementation**: EXISTS in Redis

**File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/services/activity-notification.service.ts`

```typescript
const ONLINE_USER_KEY_PREFIX = 'user-online:';
const ONLINE_TTL_SECONDS = 10 * 60; // 10 minutes

async markUserOnline(userId: string): Promise<void> {
  const key = `${ONLINE_USER_KEY_PREFIX}${userId}`;
  await redis.setex(key, ONLINE_TTL_SECONDS, '1');
}

async isUserOnline(userId: string): Promise<boolean> {
  const key = `${ONLINE_USER_KEY_PREFIX}${userId}`;
  const result = await redis.get(key);
  return result === '1';
}
```

**Frontend Avatar Component** (`/Users/mio/Developer/bojin-law-ui/src/components/ui/Avatar.tsx`):

```typescript
interface AvatarProps {
  status?: 'online' | 'offline' | 'busy';
}

const statusVariants = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
};
```

**Integration Needed**:

1. Call `markUserOnline()` on each API request (add to gateway middleware)
2. Add GraphQL query: `onlineTeamMembers: [User!]!`
3. Subscribe to presence changes (requires WebSocket setup)

---

### 5. Ephemeral Message Storage

**Infrastructure Available**: Both Redis and PostgreSQL

| Resource       | Status | Details                                     |
| -------------- | ------ | ------------------------------------------- |
| Redis          | Ready  | ioredis 5.8.2, docker-compose configured    |
| PostgreSQL     | Ready  | PostgreSQL 16 with pgvector, Prisma 5.22    |
| Cron Framework | Ready  | node-cron 4.2.1, BullMQ 5.65.0, 25+ workers |

**Existing Ephemeral Pattern** (AIConversation):

- PostgreSQL table with `status: Expired` cleanup
- `expireStaleConversations()` marks old records
- Similar to what team chat needs

**Recommended Schema** (`TeamChatMessage`):

```prisma
model TeamChatMessage {
  id        String   @id @default(uuid())
  firmId    String   @map("firm_id")
  userId    String   @map("user_id")
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  expiresAt DateTime @map("expires_at") @db.Timestamptz

  firm Firm @relation(fields: [firmId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([firmId, createdAt])
  @@index([expiresAt])
  @@map("team_chat_messages")
}
```

**Cleanup Worker Pattern** (follow `/Users/mio/Developer/bojin-law-2/services/gateway/src/workers/suggestion-cleanup.worker.ts`):

```typescript
// Schedule: Daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await prisma.teamChatMessage.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
});
```

**Environment Variables**:

- `CHAT_MESSAGE_TTL_SECONDS` (default: 86400 = 24 hours)
- `CHAT_CLEANUP_CRON` (default: '0 2 \* \* \*')

---

### 6. Similar Implementations to Reference

**Message Bubble Pattern** (`/Users/mio/Developer/bojin-law-ui/src/components/email/MessageBubble.tsx`):

- Rounded bubble with border
- Sender name + timestamp
- HTML stripping utility
- Romanian date formatting ("Azi, 14:32" / "Ieri, 09:15")

**Reply/Input Pattern** (`/Users/mio/Developer/bojin-law-ui/src/components/email/ReplyArea.tsx`):

- Textarea with keyboard shortcuts (Cmd/Ctrl + Enter)
- Send button with loading state
- Attachment support (optional for chat)

**Conversation View** (`/Users/mio/Developer/bojin-law-ui/src/components/email/EmailConversationView.tsx`):

- ScrollArea for messages
- Auto-scroll to bottom on new messages
- Loading/error/empty states

**Date Formatting Utility**:

```typescript
function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Azi, ${timeStr}`;
  if (diffDays === 1) return `Ieri, ${timeStr}`;
  return `${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}, ${timeStr}`;
}
```

---

## Patterns Discovered

### Design Tokens (for chat bubbles)

```css
/* Own message bubble (right-aligned) */
.own-message {
  background: var(--linear-accent); /* #3B82F6 dark */
  color: white;
  border-radius: 16px 16px 4px 16px;
  margin-left: auto;
}

/* Other's message bubble (left-aligned) */
.other-message {
  background: var(--linear-bg-tertiary); /* #18181B dark */
  color: var(--linear-text-primary); /* #FAFAFA dark */
  border-radius: 16px 16px 16px 4px;
}
```

### Spacing Patterns

- Content padding: `px-4` or `px-6` (16-24px)
- Message gap: `gap-2` or `gap-3` (8-12px)
- Avatar size: `w-8 h-8` (32px)
- Avatar to content: `gap-3` (12px)

### Typography

- Message text: `text-[13px]` or `text-sm`
- Timestamp: `text-[11px] text-linear-text-muted`
- Author name: `text-[13px] font-medium`

---

## Implementation Recommendation

### Phase 1: Frontend UI (No Real-Time)

1. Create `TeamChat` component with input + message list
2. Modify `ContextPanel` to show stacked layout (activity + chat)
3. Use mock data initially, same pattern as TeamActivityFeed
4. Implement iMessage-style bubbles with avatar gradients

### Phase 2: Backend API

1. Add `TeamChatMessage` Prisma model with expiry
2. Create GraphQL mutations: `sendTeamMessage`, `markMessagesRead`
3. Create GraphQL queries: `teamMessages(firmId, after, limit)`
4. Add cleanup worker following suggestion-cleanup pattern

### Phase 3: Real-Time (Optional Enhancement)

1. Set up WebSocket server in gateway
2. Add GraphQL subscriptions: `teamMessageReceived`, `typingIndicator`
3. Update frontend Apollo Client with WebSocket link
4. Implement optimistic updates for sent messages

### Phase 4: Presence (Optional Enhancement)

1. Add middleware to call `markUserOnline()` on requests
2. Create `onlineTeamMembers` query
3. Add presence subscription (requires WebSocket)
4. Update Avatar to show real-time status

---

## File Plan

| File                                          | Action | Purpose                         |
| --------------------------------------------- | ------ | ------------------------------- |
| `src/components/chat/TeamChat.tsx`            | Create | Main chat component             |
| `src/components/chat/ChatMessage.tsx`         | Create | Individual message bubble       |
| `src/components/chat/ChatInput.tsx`           | Create | Message input with send         |
| `src/components/chat/ChatTypingIndicator.tsx` | Create | "Ana scrie..." indicator        |
| `src/components/layout/ContextPanel.tsx`      | Modify | Add stacked layout with chat    |
| `src/hooks/useTeamChat.ts`                    | Create | Chat data hook (GraphQL)        |
| `src/hooks/usePresence.ts`                    | Create | Online status hook              |
| `src/types/chat.ts`                           | Create | TypeScript interfaces           |
| `src/graphql/chat.graphql`                    | Create | Queries/mutations/subscriptions |

**Backend (bojin-law-2)**:
| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add TeamChatMessage model |
| `src/graphql/schema/team-chat.graphql` | Create | Chat schema |
| `src/graphql/resolvers/team-chat.resolvers.ts` | Create | Chat resolvers |
| `src/services/team-chat.service.ts` | Create | Chat business logic |
| `src/workers/chat-cleanup.worker.ts` | Create | Daily message cleanup |

---

## Constraints Found

1. **No WebSocket server** - Real-time requires backend changes
2. **In-memory PubSub** - Single instance only; Redis PubSub needed for scaling
3. **Presence is request-based** - 10-minute TTL, not true real-time
4. **Auth via header** - WebSocket needs different auth flow (connectionParams)

---

## Risks

| Risk                       | Impact | Mitigation                         |
| -------------------------- | ------ | ---------------------------------- |
| WebSocket setup complexity | High   | Start with polling, add WS later   |
| Multi-instance PubSub      | Medium | Use Redis PubSub from start        |
| Message volume             | Low    | Daily cleanup + pagination         |
| UI performance             | Low    | Virtual scrolling if >100 messages |

---

## Next Step

Start a new session and run:

```
/plan research-team-chat
```
