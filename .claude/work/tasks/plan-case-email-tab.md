# Plan: Case Email Tab

**Status**: Approved
**Date**: 2025-01-03
**Input**: `research-case-email-tab.md`
**Next step**: `/implement plan-case-email-tab`

---

## Problem Statement

The email tab in case details currently shows nothing because sync isn't connected. Users need to see all email threads related to a case's client and actors, with the ability to reply, add internal notes, and manage case associations.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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

## Implementation Approach

Extend the existing email infrastructure by adding a **contact-based filter** to the GraphQL API and creating a **CaseEmailsTab** component that uses existing email display components. The key insight is that most components already exist (`EmailConversationView`, `ReplyArea`, `MessageBubble`, `ThreadItem`) - we just need to wire them together with case-specific querying.

---

## Tasks

### Parallel Group 1: Backend + New UI Components

> These tasks run simultaneously via sub-agents

#### Task 1.1: Add participant filter to GraphQL API

- **Implements**: Association by contact, Contact matching
- **Files**:
  - `services/gateway/src/graphql/schema/email.graphql` (MODIFY)
  - `services/gateway/src/resolvers/email.resolvers.ts` (MODIFY)
- **Do**: Add `participantEmails: [String!]` to `EmailThreadFilters` input type. Update resolver to filter threads where any email has a sender/recipient matching the provided addresses.
- **Done when**: Can query `emailThreads(filters: { participantEmails: ["a@example.com"] })` and get only threads with that participant

#### Task 1.2: Create CaseEmailFilter dropdown

- **Implements**: Client-first with case filter
- **File**: `apps/web/src/components/email/CaseEmailFilter.tsx` (CREATE)
- **Do**: Create dropdown with "Acest dosar" (This case only) and "Toate dosarele clientului" (All client cases). Use Linear design system patterns (Select component from ui).
- **Done when**: Component renders with two options, fires `onChange` with filter value

#### Task 1.3: Create InternalNoteComposer

- **Implements**: Internal notes
- **File**: `apps/web/src/components/email/InternalNoteComposer.tsx` (CREATE)
- **Do**: Simple textarea with "Adaugă notă internă" button. Team-only notes (not sent externally). Collapsible by default, expands on click.
- **Done when**: Component renders, fires `onSubmit` with note content

#### Task 1.4: Create UnlinkThreadModal

- **Implements**: Link/unlink threads
- **File**: `apps/web/src/components/email/UnlinkThreadModal.tsx` (CREATE)
- **Do**: Confirmation modal asking "Ștergi legătura cu acest dosar?". Explain thread stays in client view. Uses existing Dialog component.
- **Done when**: Modal renders, fires `onConfirm` and `onCancel`

---

### Sequential: After Group 1

#### Task 2: Create useEmailsByContact hook

- **Implements**: Association by contact, Contact matching
- **Depends on**: Task 1.1 (needs GraphQL API changes)
- **File**: `apps/web/src/hooks/useEmailsByContact.ts` (CREATE)
- **Do**:
  - Hook takes `caseId` and `filterMode` ("case" | "client")
  - Fetches case to get client email + actor emails
  - Queries `emailThreads` with `participantEmails` filter
  - For "case" mode, also filters by `caseId`
  - For "client" mode, only filters by participant emails
- **Done when**: Hook returns threads matching case participants, respects filter mode

---

### Parallel Group 2: Main Tab Component

> This task integrates all previous work

#### Task 3.1: Create CaseEmailsTab component

- **Implements**: Thread view, Reply with AI assistance, Internal notes, Link/unlink threads
- **Depends on**: Tasks 1.2, 1.3, 1.4, 2
- **File**: `apps/web/src/components/case/tabs/CaseEmailsTab.tsx` (CREATE)
- **Do**:
  - Use `useEmailsByContact` for data fetching
  - Header with `CaseEmailFilter` dropdown + sync status indicator (`useEmailSync`)
  - Two-column layout: thread list (left) + conversation view (right)
  - Thread list uses `ThreadItem` components
  - Selected thread shows `EmailConversationView` with `ReplyArea`
  - Add "Notă internă" button that expands `InternalNoteComposer`
  - Add "Dezasociază" button in header that opens `UnlinkThreadModal`
  - Empty state when no threads found
  - Loading state while fetching
- **Done when**: Tab displays threads for case, filters work, can reply and add notes

---

### Final: Integration & Verification

#### Task 4: Wire Tab to Case Detail Page

- **Depends on**: Task 3.1
- **File**: `apps/web/src/app/cases/[caseId]/page.tsx` (MODIFY)
- **Do**:
  - Import `CaseEmailsTab` component
  - Add "Email" tab to the case detail tabs
  - Pass `caseId` prop to the tab
- **Done when**: Navigating to case email tab shows the new component with working functionality

---

## Decision Coverage Check

| Decision                      | Implemented by Task(s)                         |
| ----------------------------- | ---------------------------------------------- |
| Association by contact        | Task 1.1, Task 2                               |
| Client-first with case filter | Task 1.2, Task 3.1                             |
| Thread view                   | Task 3.1 (uses existing EmailConversationView) |
| Sync frequency                | Existing infrastructure (no changes needed)    |
| Reply with AI assistance      | Task 3.1 (uses existing ReplyArea)             |
| Internal notes                | Task 1.3, Task 3.1                             |
| Link/unlink threads           | Task 1.4, Task 3.1                             |
| Microsoft Graph API           | Existing infrastructure (no changes needed)    |
| Contact matching              | Task 1.1, Task 2                               |

## Session Scope

- **Total tasks**: 7 (4 parallel + 1 sequential + 1 parallel + 1 final)
- **Complexity**: Medium

---

## Next Step

Start a new session and run:

```
/implement plan-case-email-tab
```
