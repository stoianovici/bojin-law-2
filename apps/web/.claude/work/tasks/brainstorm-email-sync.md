# Brainstorm: Email Processing and Sync

**Status**: Complete
**Date**: 2024-12-29
**Next step**: `/research brainstorm-email-sync`

---

## Context

**Project:** bojin-law-ui (new frontend replacing bojin-law-2's UI)
**Tech Stack:** Next.js 16, TypeScript, Apollo Client, Zustand, Linear design system
**Backend:** Shared gateway at localhost:4000 (from bojin-law-2 monorepo)
**Source Reference:** /Users/mio/Developer/bojin-law-2

The new UI has 12 email components already built with Linear design language, but not connected to the backend. The existing bojin-law-2 has mature email services that need to be selectively ported and simplified.

---

## Problem Statement

Port email processing and sync from bojin-law-2 to work with bojin-law-ui, while:

1. Simplifying the over-engineered multi-case classification flow
2. Adding improved INSTANȚE (court email) parsing with attachment support
3. Removing unnecessary friction (confirmation blocking)
4. Keeping the existing UI components unchanged

---

## Decisions

### 1. Simplified Email Classification Model

**Three buckets only:**

```
Incoming Email
    ↓
┌─────────────────────────────────┐
│ Sender in court/authority list? │
└─────────────────────────────────┘
    ↓ Yes                      ↓ No
    ↓                    ┌─────────────────┐
    ↓                    │ Sender known?   │
    ↓                    │ (case contact)  │
    ↓                    └─────────────────┘
    ↓                      ↓ Yes      ↓ No
    ↓                      ↓          ↓
    ↓                 Auto-assign   NECLAR
    ↓                 (best guess)  (unknown sender)
    ↓
INSTANȚE AI Parser
    ↓
Extract "dosar nr" from:
  1. Email subject (first)
  2. Email body (second)
  3. Attachments - PDF/doc parsing (fallback only)
    ↓
┌─────────────────┐
│ Match found?    │
└─────────────────┘
  ↓ Yes        ↓ No
Auto-assign   INSTANȚE queue
to case       (manual assignment)
```

**Key simplifications:**

- NECLAR = unknown sender only (not "uncertain classification")
- No multi-case confirmation blocking (OPS-195 removed)
- Best-guess assignment with "suggested" indicator
- One-click reassignment if wrong

### 2. INSTANȚE (Court Email) AI Parser

**Extraction logic:**

1. Parse subject line for "dosar nr. XXX/YY/ZZZZ" pattern
2. If not found, parse email body
3. If still not found, parse PDF/doc attachments (fallback)

**Auto-save behavior:**

- When user manually assigns court email to a case
- Automatically save extracted "dosar nr" as court case number on the case record

### 3. Backend Services to Port

| Service            | Source File                 | Action                          |
| ------------------ | --------------------------- | ------------------------------- |
| Email sync         | email-sync.service.ts       | Keep - MS Graph integration     |
| Thread grouping    | email-thread.service.ts     | Keep - conversationId threading |
| Attachments        | email-attachment.service.ts | Keep - sync, preview, storage   |
| Send/reply         | email.service.ts            | Keep - MS Graph sending         |
| Webhooks           | email-webhook.service.ts    | Keep - real-time notifications  |
| AI drafting        | email-drafting.service.ts   | Keep - Claude integration       |
| Search             | email-search.service.ts     | Keep - full-text search         |
| Personal blocklist | (in email-sync)             | Keep - filter personal contacts |

### 4. Features to Simplify/Remove

| Feature                           | Current (bojin-law-2)                 | New Approach               |
| --------------------------------- | ------------------------------------- | -------------------------- |
| Multi-case confirmation (OPS-195) | Blocks reply until confirmed          | Remove - no blocking       |
| NECLAR queue                      | Uncertain classification              | Unknown sender only        |
| Classification confidence scoring | Complex 0.0-1.0 with thresholds       | Simple best-guess          |
| EmailCaseLink complexity          | needsConfirmation, isConfirmed fields | Remove confirmation fields |

### 5. New/Improved Features

| Feature                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| INSTANȚE AI parser        | Extract dosar nr from body → attachments (fallback) |
| Auto-save court reference | When assigning court email → save dosar nr to case  |
| "Suggested" indicator     | UI hint for AI-guessed assignments                  |
| One-click reassign        | Quick case change in thread header                  |
| Draft/Send toggle         | Keep draft mode, add simple switch for actual send  |

### 6. Deferred Features (Don't Port Initially)

| Feature                                             | Reason                   |
| --------------------------------------------------- | ------------------------ |
| Email content cleaning (OPS-090)                    | Only add if needed later |
| Partner privacy (OPS-191)                           | Not required initially   |
| Complex extractions (deadlines, commitments, risks) | Add when needed          |
| Attachment filtering (OPS-136)                      | Low priority             |

### 7. UI Approach

- **Keep all 12 existing components unchanged**
- Wire up to simplified backend via existing GraphQL queries
- Minor additions:
  - "Suggested" badge on auto-assigned emails
  - One-click reassign button in ConversationHeader

---

## Rationale

### Why simplify multi-case?

The OPS-195 confirmation flow blocked users from replying until they confirmed the case assignment. This created friction for every multi-case client email. The risk of "wrong case briefly" is acceptable per user confirmation. Best-guess + easy correction is less friction for 80%+ of emails.

### Why NECLAR = unknown sender only?

If sender is a known contact, we can always make a reasonable guess. The only true "uncertain" case is when we don't know who the sender is. This simplifies the mental model and reduces queue size.

### Why parse attachments as fallback?

Court emails usually have dosar nr in the body. Attachment parsing (PDF/doc) is computationally heavier. Fallback approach optimizes for the common case while handling edge cases.

### Why auto-save court reference?

When user manually assigns a court email to a case, they're confirming "this dosar nr belongs to this case." Capturing this automatically builds the case's reference data without extra user effort.

---

## Open Questions for Research

- [ ] What's the exact regex pattern for Romanian court case numbers (dosar nr)?
- [ ] Which PDF parsing library to use for attachment extraction?
- [ ] How does the existing email-sync delta token work (or doesn't work)?
- [ ] What GraphQL schema changes are needed for the simplified model?
- [ ] How to handle the "suggested" indicator in the existing ThreadItem component?

---

## Database Model Changes

**EmailCaseLink - simplify:**

```diff
model EmailCaseLink {
  // Keep
  id            String
  emailId       String
  caseId        String
  matchType     String
  confidence    Float
  isPrimary     Boolean

  // Remove
- needsConfirmation  Boolean
- isConfirmed        Boolean
- confirmedAt        DateTime?
- confirmedBy        String?
}
```

**Email - add suggested flag:**

```diff
model Email {
  // Existing fields...

  // Add
+ isSuggestedAssignment  Boolean  @default(false)
}
```

---

## Implementation Scope

### Phase 1: Core Wiring

1. Connect existing UI components to gateway
2. Port email-sync, email-thread, email-attachment services
3. Implement simplified classification (without INSTANȚE AI)
4. Basic NECLAR (unknown sender) flow

### Phase 2: INSTANȚE Enhancement

1. Add dosar nr extraction (regex on subject/body)
2. Add attachment parsing (PDF fallback)
3. Auto-save court reference on assignment

### Phase 3: Polish

1. "Suggested" indicator UI
2. One-click reassign
3. Draft/send toggle

---

## Next Step

Start a new session and run:

```
/research brainstorm-email-sync
```

Research should investigate:

1. Exact files to port from bojin-law-2
2. GraphQL schema changes needed
3. Dosar nr regex patterns
4. PDF parsing options
5. Delta sync investigation
