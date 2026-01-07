# Implementation Plan: Internal Chat & Activity Monitor

## Overview

Make the internal chat and activity monitoring features fully functional on the deployed app. The backend infrastructure exists but frontend connections and integrations are missing.

**Scope (4 Phases)**:

1. Team Chat Frontend Integration
2. WebSocket/Subscription Setup
3. Push Notification Integration
4. Activity Feed UI

_Email digest integration deferred for later._

---

## Phase 1: Team Chat Frontend Integration

**Goal**: Connect the mock chat UI to the real GraphQL backend

### Files to Modify

- `apps/web/src/components/chat/TeamChat.tsx` - Main chat component (currently uses mock data lines 27-82)
- `apps/web/src/components/chat/ChatInput.tsx` - Message input component
- `apps/web/src/components/chat/ChatTypingIndicator.tsx` - Typing indicator

### Tasks

1. **Create GraphQL hooks for team chat**
   - Create `apps/web/src/hooks/useTeamChat.ts`
   - Implement `useTeamChatMessages` query hook with pagination
   - Implement `useSendTeamChatMessage` mutation hook
   - Implement `useDeleteTeamChatMessage` mutation hook
   - Implement `useSetTeamChatTyping` mutation hook

2. **Add GraphQL subscription hooks**
   - Implement `useTeamChatMessageReceived` subscription
   - Implement `useTeamChatMessageDeleted` subscription
   - Implement `useTeamChatTypingUpdated` subscription

3. **Update TeamChat.tsx**
   - Remove mock data (lines 27-82)
   - Replace with real GraphQL queries
   - Wire up subscriptions for real-time updates
   - Handle loading and error states

4. **Update ChatInput.tsx**
   - Connect to `sendTeamChatMessage` mutation
   - Integrate typing indicator via `setTeamChatTyping` mutation
   - Add debounced typing status updates

5. **Update ChatTypingIndicator.tsx**
   - Subscribe to `teamChatTypingUpdated`
   - Display real typing users from backend

### GraphQL Schema Reference

```graphql
# Existing schema at services/gateway/src/graphql/schema/team-chat.graphql
query teamChatMessages(limit: Int, offset: Int, parentId: ID): [TeamChatMessage!]!
query teamChatTypingUsers: [TeamChatTypingUser!]!
mutation sendTeamChatMessage(content: String!, parentId: ID, mentions: [ID!]): TeamChatMessage!
mutation deleteTeamChatMessage(messageId: ID!): Boolean!
mutation setTeamChatTyping(isTyping: Boolean!): Boolean!
subscription teamChatMessageReceived: TeamChatMessage!
subscription teamChatMessageDeleted: ID!
subscription teamChatTypingUpdated: [TeamChatTypingUser!]!
```

---

## Phase 2: WebSocket/Subscription Setup

**Goal**: Ensure GraphQL subscriptions work in production

### Files to Check/Modify

- `apps/web/src/lib/apollo-client.ts` or equivalent - Apollo client config
- `services/gateway/src/index.ts` - Gateway WebSocket setup

### Tasks

1. **Verify gateway WebSocket configuration**
   - Check that `graphql-ws` or `subscriptions-transport-ws` is configured
   - Ensure PubSub is properly initialized for subscriptions
   - Verify Redis connection for typing indicators

2. **Configure Apollo Client for subscriptions**
   - Add WebSocket link for subscriptions
   - Set up split link (HTTP for queries/mutations, WS for subscriptions)
   - Handle authentication over WebSocket

3. **Test subscription connectivity**
   - Verify subscriptions work locally before deployment
   - Check CORS and WebSocket upgrade headers for production

---

## Phase 3: Push Notification Integration

**Goal**: Enable real push notifications to users' devices

### Files to Modify

- `services/gateway/src/services/activity-notification.service.ts` - Stubbed at line 197
- `services/gateway/package.json` - Add web-push dependency
- `apps/web/public/sw.js` (create) - Service worker for push
- `apps/web/src/hooks/usePushNotifications.ts` (create) - Frontend hook

### Tasks

1. **Install web-push library**

   ```bash
   pnpm --filter gateway add web-push
   pnpm --filter gateway add -D @types/web-push
   ```

2. **Generate VAPID keys**
   - Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to environment
   - Add `VAPID_SUBJECT` (mailto: or https: URL)

3. **Implement push delivery in activity-notification.service.ts**
   - Import and configure web-push
   - Replace stub at line ~197 with actual `webpush.sendNotification()`
   - Handle subscription expiration/errors

4. **Create service worker (apps/web/public/sw.js)**
   - Handle `push` event to display notification
   - Handle `notificationclick` to navigate to relevant page
   - Register in app initialization

5. **Create usePushNotifications hook**
   - Request notification permission
   - Get push subscription from browser
   - Call `subscribeToPush` mutation with subscription details
   - Handle unsubscribe flow

6. **Add UI for push notification opt-in**
   - Add toggle in user settings
   - Show permission request on first enable

---

## Phase 4: Activity Feed UI

**Goal**: Expose case activity feed in the UI

### Files to Create/Modify

- `apps/web/src/components/cases/CaseActivityFeed.tsx` (create)
- `services/gateway/src/graphql/schema/case-activity.graphql` (create)
- `services/gateway/src/graphql/resolvers/case-activity.resolvers.ts` (create)

### Tasks

1. **Create GraphQL schema for case activity**

   ```graphql
   type CaseActivityEntry {
     id: ID!
     activityType: CaseActivityType!
     entityType: String!
     entityId: ID
     title: String!
     summary: String
     metadata: JSON
     actor: User!
     createdAt: DateTime!
   }

   type Query {
     caseActivityFeed(caseId: ID!, limit: Int, cursor: String): CaseActivityConnection!
   }
   ```

2. **Create resolvers**
   - Query resolver using existing `CaseActivityService`
   - Implement cursor-based pagination

3. **Create CaseActivityFeed component**
   - Timeline-style display
   - Icons per activity type
   - Link to related entities (tasks, documents, etc.)

4. **Integrate into case detail page**
   - Add activity tab or sidebar section
   - Lazy load for performance

---

## Environment Variables Required

```env
# Push Notifications (Phase 3)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@bojin-law.com

# Existing (verify configured)
REDIS_URL=  # Required for typing indicators
```

---

## Testing Checklist

- [ ] Team chat messages send and appear in real-time
- [ ] Typing indicators show when other users type
- [ ] Message deletion works and syncs across clients
- [ ] Push notifications delivered to subscribed devices
- [ ] Activity feed shows case-related events
- [ ] All features work on deployed production environment

---

## Deployment Notes

1. **Database**: No migrations needed - tables already exist
2. **Redis**: Ensure Redis is running for typing indicators and online status
3. **WebSocket**: Verify load balancer supports WebSocket upgrade
4. **Environment**: Add new env vars before deploying push/email features

---

## Key Files Reference

### Existing Backend Services (fully implemented)

- `services/gateway/src/services/team-chat.service.ts` - Chat logic with Redis
- `services/gateway/src/services/case-activity.service.ts` - Case activity tracking
- `services/gateway/src/services/activity-event.service.ts` - User activity events
- `services/gateway/src/services/activity-notification.service.ts` - Notification routing
- `services/gateway/src/workers/chat-cleanup.worker.ts` - 24h message expiry
- `services/gateway/src/workers/notification-processor.worker.ts` - Notification processing

### Existing Frontend Components (need wiring)

- `apps/web/src/components/chat/TeamChat.tsx` - Mock data at lines 27-82
- `apps/web/src/components/chat/ChatInput.tsx`
- `apps/web/src/components/chat/ChatMessage.tsx`
- `apps/web/src/components/chat/ChatTypingIndicator.tsx`

### GraphQL Schemas

- `services/gateway/src/graphql/schema/team-chat.graphql` - Chat operations
- `services/gateway/src/graphql/schema/notification.graphql` - Notification operations

### Database Models (already exist in Prisma)

- `TeamChatMessage` - Chat messages with threading
- `CaseActivityEntry` - Case-level activity
- `UserActivityEvent` - User activity events
- `InAppNotification` - In-app notifications
- `PushSubscription` - Web push subscriptions
- `DigestQueue` - Daily digest queue
