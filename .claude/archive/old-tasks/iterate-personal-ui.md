# Iteration: Personal Email UI

**Status**: Ready for Implementation
**Date**: 2026-01-08
**Screenshots**: `.claude/work/screenshots/iterate-personal-ui/`
**Next step**: Run `/implement iterate-personal-ui` to implement

---

## Requirements Summary

Two different behaviors depending on context:

| Context             | Button             | Action                 | Result                                                                   |
| ------------------- | ------------------ | ---------------------- | ------------------------------------------------------------------------ |
| **NECLAR**          | "Contact personal" | Block sender           | Adds sender to `personalContact` blocklist, email disappears from NECLAR |
| **Assigned thread** | "Privat" (NEW)     | Mark thread as private | Thread hidden from team, but partner can still see it and toggle         |

---

## Current State Analysis

### What Already Works

- `MARK_SENDER_AS_PERSONAL` mutation blocks sender (adds to `personalContact` table)
- `PersonalEmailList` component in Settings shows blocked contacts
- Settings page at `/settings?tab=firm` has "Adrese Email Personale" section

### What's Missing

1. **"Privat" button in ConversationHeader** for assigned threads
2. **Database mechanism** to track which threads are marked private (and by whom)
3. **Query filter** to hide private threads from team members (but show to marking partner)
4. **Toggle capability** for partner to unmark private threads

---

## Implementation Tasks

### Task 1: Add PersonalThread Database Model

- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add new model:

  ```prisma
  model PersonalThread {
    id             String   @id @default(uuid())
    conversationId String   @map("conversation_id")
    userId         String   @map("user_id")  // Partner who marked it
    firmId         String   @map("firm_id")
    createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
    user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    firm           Firm     @relation(fields: [firmId], references: [id], onDelete: Cascade)

    @@unique([conversationId, firmId])
    @@index([userId])
    @@index([firmId])
    @@map("personal_threads")
  }
  ```

- **Done when**: Migration runs successfully

### Task 2: Add GraphQL Schema for Personal Threads

- **File**: `services/gateway/src/graphql/schema/personal-contact.graphql` (MODIFY)
- **Do**: Add mutations and types:

  ```graphql
  type PersonalThread {
    id: ID!
    conversationId: String!
    userId: String!
    createdAt: DateTime!
  }

  extend type Mutation {
    markThreadAsPersonal(conversationId: String!): PersonalThread!
    unmarkThreadAsPersonal(conversationId: String!): Boolean!
  }

  extend type Query {
    isThreadPersonal(conversationId: String!): Boolean!
  }
  ```

- **Done when**: Schema compiles without errors

### Task 3: Implement Personal Thread Service

- **File**: `services/gateway/src/services/personal-contact.service.ts` (MODIFY)
- **Do**: Add methods:
  - `markThreadAsPersonal(userId, firmId, conversationId)` - creates PersonalThread record
  - `unmarkThreadAsPersonal(userId, firmId, conversationId)` - deletes PersonalThread record
  - `isThreadPersonal(firmId, conversationId)` - checks if thread is marked
  - `getPersonalThreadIds(firmId)` - returns list of conversationIds marked as personal
- **Done when**: Service methods work correctly

### Task 4: Add Resolvers for Personal Threads

- **File**: `services/gateway/src/graphql/resolvers/personal-contact.resolvers.ts` (MODIFY)
- **Do**: Add resolver functions for new mutations/queries
- **Done when**: GraphQL playground shows new operations

### Task 5: Filter Personal Threads in Email Queries

- **File**: `services/gateway/src/graphql/resolvers/email.resolvers.ts` (MODIFY)
- **Do**: Modify `emailsByCase` query to:
  - For non-partner users: exclude threads where `conversationId` is in `personal_threads` for that firm
  - For the partner who marked it: include the thread (they can still see it)
- **Done when**: Personal threads hidden from team but visible to marking partner

### Task 6: Add Frontend GraphQL Mutations

- **File**: `apps/web/src/graphql/queries.ts` (MODIFY)
- **Do**: Add:

  ```typescript
  export const MARK_THREAD_AS_PERSONAL = gql`
    mutation MarkThreadAsPersonal($conversationId: String!) {
      markThreadAsPersonal(conversationId: $conversationId) {
        id
        conversationId
      }
    }
  `;

  export const UNMARK_THREAD_AS_PERSONAL = gql`
    mutation UnmarkThreadAsPersonal($conversationId: String!) {
      unmarkThreadAsPersonal(conversationId: $conversationId)
    }
  `;
  ```

- **Done when**: Mutations can be imported

### Task 7: Add "Privat" Button to ConversationHeader

- **File**: `apps/web/src/components/email/ConversationHeader.tsx` (MODIFY)
- **Do**:
  - Add props: `isPersonal?: boolean`, `onTogglePersonal?: () => void`
  - Add button with `User` or `UserX` icon based on state
  - Label: "Privat" when not marked, "Faceți public" when marked
  - Only show when `thread.case` exists (assigned thread)
- **Done when**: Button appears in header for assigned threads

### Task 8: Wire Up Personal Thread Toggle in Email Page

- **File**: `apps/web/src/app/(dashboard)/email/page.tsx` (MODIFY)
- **Do**:
  - Add `useMutation` for `MARK_THREAD_AS_PERSONAL` and `UNMARK_THREAD_AS_PERSONAL`
  - Add state/query to know if current thread is personal
  - Add handler `handleTogglePersonal` that calls appropriate mutation
  - Pass props to `EmailConversationView` → `ConversationHeader`
- **Done when**: Clicking button toggles thread visibility

### Task 9: Update EmailThread Type

- **File**: `apps/web/src/types/email.ts` (MODIFY)
- **Do**: Add `isPersonal?: boolean` to `EmailThread` type
- **Done when**: Type includes new field

---

## UI Mockup

### ConversationHeader with "Privat" Button (for assigned threads)

```
┌────────────────────────────────────────────────────────────────────┐
│ Subiect: Re: Contract de vânzare-cumpărare                         │
│ [Popescu vs. Ionescu] f8f501d6-2025-004                            │
│ De la: Ion Popescu                                                 │
│                                                                    │
│  [💬][📋]  [📎 3]  [✏️]  [↗️]  [🔄 Reasignează]  [👤 Privat]      │
└────────────────────────────────────────────────────────────────────┘
```

When marked as private:

```
│  [💬][📋]  [📎 3]  [✏️]  [↗️]  [🔄 Reasignează]  [👤 Faceți public] │
```

---

## Verification Checklist

- [ ] Partner can mark assigned thread as "Privat"
- [ ] Thread disappears from team members' email list
- [ ] Thread still visible to the partner who marked it
- [ ] Partner can unmark (toggle back to public)
- [ ] NECLAR "Contact personal" still works (blocks sender)
- [ ] Personal contacts appear in Settings

---

## Files to Modify

| File                                                                   | Action                   |
| ---------------------------------------------------------------------- | ------------------------ |
| `packages/database/prisma/schema.prisma`                               | Add PersonalThread model |
| `services/gateway/src/graphql/schema/personal-contact.graphql`         | Add mutations            |
| `services/gateway/src/services/personal-contact.service.ts`            | Add service methods      |
| `services/gateway/src/graphql/resolvers/personal-contact.resolvers.ts` | Add resolvers            |
| `services/gateway/src/graphql/resolvers/email.resolvers.ts`            | Filter personal threads  |
| `apps/web/src/graphql/queries.ts`                                      | Add frontend mutations   |
| `apps/web/src/components/email/ConversationHeader.tsx`                 | Add "Privat" button      |
| `apps/web/src/app/(dashboard)/email/page.tsx`                          | Wire up toggle handler   |
| `apps/web/src/types/email.ts`                                          | Add isPersonal field     |
