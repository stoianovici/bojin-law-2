# Research: Case Email Tab

**Status**: Complete
**Date**: 2025-01-03
**Input**: `brainstorm-case-email-tab.md`
**Next step**: `/plan research-case-email-tab`

---

## Problem Statement

The email tab in case details currently shows nothing because sync isn't connected. Users need to see all email threads related to a case's client and actors, with the ability to reply, add internal notes, and manage case associations.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision                      | Details                                                                                               | Rationale                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Association by contact        | Emails linked to cases via matching participants (client email, actor emails)                         | Natural grouping without manual work                                     |
| Client-first with case filter | Default shows all threads with case client; dropdown to filter "This case only" or "All client cases" | Handles multi-case clients naturally, provides full relationship context |
| Thread view                   | Conversations grouped as threads (like Gmail), not flat message list                                  | Easier to follow conversation flow                                       |
| Sync frequency                | Every 1 minute from Microsoft Graph                                                                   | Near real-time without excessive API calls                               |
| Reply with AI assistance      | Composer opens with AI-drafted response based on thread context + case info                           | Core AI value-add for the platform                                       |
| Internal notes                | Team-only notes attached to thread, not sent externally                                               | Enables collaboration without client visibility                          |
| Link/unlink threads           | Move or copy thread to different case; unlink removes from current case but stays in client view      | Flexibility for mis-categorized or multi-case emails                     |

### Technical Decisions

| Decision            | Details                                                                 | Rationale                                                  |
| ------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Microsoft Graph API | Use existing Graph integration for email retrieval                      | Already authenticated via Azure AD                         |
| Contact matching    | Match email addresses against case.client.email and case.actors[].email | Deterministic, no AI classification needed for association |

### Out of Scope

- Sending new emails (only reply to existing threads)
- Email search within case (defer to global search)
- Attachment preview inline (use existing document preview)
- Calendar integration in email tab

---

## Research Findings

### Open Questions - Answered

| Question                                                             | Answer                                                                                                                                                                    | Evidence                                                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| What is the current state of email sync infrastructure?              | Full sync system exists using MS Graph API. Two-phase sync (full initial + incremental). Syncs from all folders with pagination. State tracked in `EmailSyncState` table. | `services/gateway/src/services/email-sync.service.ts:133-251`                                                                |
| How are emails currently stored in the database schema?              | Single Email model with multi-case support via `EmailCaseLink` junction table (OPS-058). Threads grouped by `conversationId`. Recipients stored as JSON.                  | `packages/database/prisma/schema.prisma:2785-2860, 4022-4043`                                                                |
| What GraphQL queries/mutations exist for emails?                     | Full CRUD: `emailThreads`, `emailThread`, `assignThreadToCase`, `linkEmailToCase`, `unlinkEmailFromCase`, `replyToEmail`, `startEmailSync`                                | `services/gateway/src/graphql/schema/email.graphql`                                                                          |
| How does the existing `useEmailSync` hook work?                      | Polls `emailSyncStatus` query, calls `startEmailSync` mutation. Returns `syncStatus`, `loading`, `syncing`, `startSync()`, `refetch()`.                                   | `apps/web/src/hooks/useEmailSync.ts:22-50`                                                                                   |
| Is there existing email-to-case linking logic?                       | Yes, extensive. Multi-stage classification: reference number → actor email → keywords → AI semantic. Manual link/unlink via GraphQL mutations.                            | `services/gateway/src/services/email-to-case.service.ts`, `services/ai-service/src/services/email-classification.service.ts` |
| What does the Communications page currently do vs what we need here? | CommunicationsTab exists showing threads with conversation view. Uses same patterns we need. Has AI summary panel. Needs adaptation for case-specific filtering.          | `apps/web/src/components/case/tabs/CommunicationsTab.tsx`                                                                    |

### Existing Code Analysis

| Category        | Files                                                                                                         | Notes                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Reuse as-is** | `MessageBubble.tsx`, `ThreadItem.tsx`, `AttachmentListPanel.tsx`, `ReplyArea.tsx`, `HistoricalSyncStatus.tsx` | Drop-in components for thread display, reply, attachments            |
| **Reuse as-is** | `useEmailSync.ts`, `useEmailThread.ts`, `useAiEmailDraft.ts`                                                  | Hooks for sync status, thread fetching, AI drafts                    |
| **Modify**      | `EmailConversationView.tsx`                                                                                   | Main thread viewer - remove NECLAR props, customize for case context |
| **Modify**      | `ConversationHeader.tsx`                                                                                      | Thread header - already shows case badge, customize actions          |
| **Modify**      | `CommunicationsTab.tsx`                                                                                       | Current tab - needs filter dropdown, contact-based querying          |
| **Create new**  | Internal notes composer                                                                                       | Previous implementation was deleted, need fresh component            |
| **Create new**  | Unlink from case modal                                                                                        | Only assignment exists, need unlink confirmation flow                |
| **Create new**  | Case email filter dropdown                                                                                    | "This case only" / "All client cases" filter                         |

### Patterns Discovered

**Tab Component Pattern** (from existing tabs):

```typescript
// File: apps/web/src/components/case/tabs/*.tsx
export interface [Tab]Props {
  caseId: string;
  className?: string;
}

export function [Tab]({ caseId, ...props }: [Tab]Props) {
  // 1. Hooks for data fetching
  const { data, loading, error } = useCustomHook(caseId);

  // 2. JSX with container pattern
  return (
    <div className="flex flex-col h-full bg-linear-bg-secondary">
      {/* Content */}
    </div>
  );
}
```

**Thread Display Pattern** (from `EmailConversationView.tsx`):

- Sorts emails chronologically (oldest first)
- Maps to `MessageBubble` components
- Auto-scrolls to bottom on new messages
- Uses `ScrollArea` for scrolling content

**Message Formatting** (from `MessageBubble.tsx`):

- `stripHtml(html)` - converts HTML to plain text
- `formatMessageDate(date)` - "Today, HH:MM", "Yesterday, HH:MM", or "DD MMM, HH:MM"
- Bubbles: `rounded-xl px-4 py-3 bg-linear-bg-tertiary border`

**Reply Area Pattern** (from `ReplyArea.tsx`):

- AI Quick Reply button (Zap icon) - one-click suggestions
- AI Prompt input (Sparkles icon) - custom instruction generation
- Textarea for manual reply
- Keyboard shortcut: Cmd/Ctrl + Enter to send

**Email-Case Linking** (from GraphQL schema):

```graphql
# Link email to additional case
linkEmailToCase(emailId, caseId, isPrimary): EmailCaseLink!
# Unlink email from case
unlinkEmailFromCase(emailId, caseId): Boolean!
# Assign thread to case (all emails in thread)
assignThreadToCase(conversationId, caseId): AssignThreadResult!
```

**Multi-Case Email Model** (from Prisma schema):

```prisma
model EmailCaseLink {
  emailId   String
  caseId    String
  confidence Float?
  matchType ClassificationMatchType  // Actor | Manual | ThreadContinuity | etc.
  isPrimary Boolean
  @@unique([emailId, caseId])
}
```

### Constraints Found

- **Token Requirement**: Email sync requires MS Graph `accessToken` in GraphQL context. If missing, throws `MS_TOKEN_REQUIRED` error.
- **Internal Notes Deleted**: Previous `InternalNoteComposer.tsx` was removed in feature branch. Need fresh implementation.
- **Thread Grouping**: Emails grouped by `conversationId` from Microsoft Graph, not by case. Multi-case threads possible.
- **Sync State per User**: `EmailSyncState` is per-user, not per-case. One sync covers all cases.
- **Privacy Controls**: `Email.isPrivate` flag for partner-only emails, must respect in queries.

---

## Implementation Recommendation

The case email tab should **extend the existing `CommunicationsTab`** rather than rebuild from scratch. The core infrastructure (sync, threading, display components) exists and works.

**Approach:**

1. **Add filter dropdown** to `CommunicationsTab` header:
   - "Acest dosar" (This case only) - default
   - "Toate dosarele clientului" (All client cases)

2. **Query by contact matching**:
   - Get case client email + actor emails
   - Query `emailThreads` with participant filter
   - For "All client cases" mode, query without caseId filter

3. **Reuse existing components**:
   - `EmailConversationView` for thread display
   - `ReplyArea` for AI-assisted replies
   - `MessageBubble` for individual messages
   - `ThreadItem` for thread list

4. **Add internal notes**:
   - Create simple note composer (textarea + privacy selector)
   - Store as `CommunicationEntry` with `channelType: INTERNAL_NOTE`
   - Display inline in thread with visual distinction

5. **Add link/unlink actions**:
   - Use existing `linkEmailToCase` / `unlinkEmailFromCase` mutations
   - Add action buttons in thread header
   - Show confirmation modal for unlink

## File Plan

| File                                                      | Action | Purpose                                           |
| --------------------------------------------------------- | ------ | ------------------------------------------------- |
| `apps/web/src/components/case/tabs/CommunicationsTab.tsx` | Modify | Add filter dropdown, contact-based queries        |
| `apps/web/src/components/email/EmailConversationView.tsx` | Modify | Add link/unlink buttons, internal note support    |
| `apps/web/src/components/email/InternalNoteComposer.tsx`  | Create | Simple note input with privacy selector           |
| `apps/web/src/components/email/UnlinkThreadModal.tsx`     | Create | Confirmation modal for unlinking thread from case |
| `apps/web/src/components/email/CaseEmailFilter.tsx`       | Create | Dropdown for "This case" / "All client cases"     |
| `apps/web/src/hooks/useEmailsByContact.ts`                | Create | Query emails by participant email addresses       |
| `apps/web/src/graphql/queries.ts`                         | Modify | Add GET_EMAILS_BY_CONTACT query                   |

## Risks

| Risk                                 | Mitigation                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Performance with large email volumes | Use pagination (already supported in emailThreads query), lazy load thread content |
| Multi-case thread confusion          | Show case badge on each thread, allow filter to "This case only"                   |
| Sync not running                     | Show sync status indicator, prompt user to connect Microsoft account               |
| Privacy leaks                        | Respect `isPrivate` flag in queries, filter by user permissions                    |
| Internal notes visible externally    | Store as `INTERNAL_NOTE` channel type, never send via Graph API                    |

---

## Next Step

Start a new session and run:

```
/plan research-case-email-tab
```
