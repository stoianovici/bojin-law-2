# Research: Email Processing and Sync

**Status**: Complete
**Date**: 2024-12-29
**Input**: `brainstorm-email-sync.md`
**Next step**: `/plan research-email-sync`

---

## Context Summary

**Project:** bojin-law-ui (new frontend replacing bojin-law-2's UI)
**Tech Stack:** Next.js 16, TypeScript, Apollo Client, Zustand, Linear design system
**Backend:** Shared gateway at localhost:4000 (from bojin-law-2 monorepo)
**Source Reference:** /Users/mio/Developer/bojin-law-2

The UI has 12 email components already built with Linear design language. These need to be connected to the simplified backend. The existing bojin-law-2 has mature email services that will be selectively ported and simplified.

---

## Problem Statement

Port email processing and sync from bojin-law-2 to work with bojin-law-ui, while:

1. Simplifying the over-engineered multi-case classification flow (removing OPS-195 confirmation blocking)
2. Adding improved INSTANȚE (court email) parsing with attachment support
3. Removing unnecessary friction (confirmation blocking)
4. Keeping the existing UI components unchanged

---

## Research Findings

### Existing Code Analysis

#### Backend Services to Port (bojin-law-2)

| Service                         | Path                                 | Purpose                                    | Action   |
| ------------------------------- | ------------------------------------ | ------------------------------------------ | -------- |
| email-sync.service.ts           | `/services/gateway/src/services/`    | MS Graph sync, delta tokens, multi-folder  | Keep     |
| email-thread.service.ts         | `/services/gateway/src/services/`    | ConversationId grouping, privacy filtering | Keep     |
| email-attachment.service.ts     | `/services/gateway/src/services/`    | R2/OneDrive storage, sync on access        | Keep     |
| email.service.ts                | `/services/gateway/src/services/`    | Send/reply via Graph API                   | Keep     |
| email-webhook.service.ts        | `/services/gateway/src/services/`    | Real-time notifications, DLQ               | Keep     |
| email-drafting.service.ts       | `/services/gateway/src/services/`    | Claude AI integration                      | Keep     |
| email-search.service.ts         | `/services/gateway/src/services/`    | Full-text + semantic search                | Keep     |
| email-classification.service.ts | `/services/ai-service/src/services/` | Multi-stage weighted scoring               | Simplify |
| reference-extractor.ts          | `/services/ai-service/src/utils/`    | Dosar nr regex patterns                    | Port     |

#### UI Components Ready (bojin-law-ui)

All 12 components are fully built with Linear design language:

| Component             | Path                     | Status   | Integration Notes                        |
| --------------------- | ------------------------ | -------- | ---------------------------------------- |
| ThreadItem            | `/src/components/email/` | Complete | Add "suggested" badge for AI assignments |
| ConversationHeader    | `/src/components/email/` | Complete | Add "Reassign" button                    |
| EmailConversationView | `/src/components/email/` | Complete | Wire NECLAR mode                         |
| MessageBubble         | `/src/components/email/` | Complete | Ready                                    |
| ReplyArea             | `/src/components/email/` | Complete | AI integration ready                     |
| ComposeEmailModal     | `/src/components/email/` | Complete | Need case picker, draft save             |
| CaseAccordion         | `/src/components/email/` | Complete | Ready                                    |
| EmailCaseSidebar      | `/src/components/email/` | Complete | All 4 sections built                     |
| UncertainEmailItem    | `/src/components/email/` | Complete | Confidence color-coding done             |
| SplitAssignmentButton | `/src/components/email/` | Complete | Ready for NECLAR                         |
| NeclarAssignmentBar   | `/src/components/email/` | Complete | Ready                                    |
| AttachmentListPanel   | `/src/components/email/` | Complete | Ready                                    |

#### GraphQL Queries/Mutations Already Defined

**File:** `/Users/mio/Developer/bojin-law-ui/src/graphql/queries.ts`

- `GET_EMAILS_BY_CASE` - Sidebar data (cases, unassigned, court, uncertain)
- `GET_EMAIL_THREAD` - Full thread with messages and attachments
- `GET_EMAIL_THREADS` - List with filters
- `GET_EMAIL_STATS` - Statistics
- `GET_COURT_EMAILS` - Court communications
- `GET_UNCERTAIN_EMAILS` - NECLAR queue
- `GET_EMAIL_SYNC_STATUS` - Sync monitoring
- `SEND_EMAIL`, `REPLY_TO_EMAIL` - Send operations
- `ASSIGN_THREAD_TO_CASE` - Assignment
- `CLASSIFY_UNCERTAIN_EMAIL` - NECLAR classification
- `START_EMAIL_SYNC` - Trigger sync
- `GENERATE_AI_REPLY`, `GENERATE_QUICK_REPLY` - AI drafting

#### Hooks Already Built

- `useEmailsByCase()` - Fetches sidebar data
- `useEmailThread(conversationId)` - Single thread fetch
- `useEmailSync()` - Sync status and actions
- `useAiEmailDraft()` - AI reply generation
- `useGraphQL()` - Low-level Apollo wrapper

---

### Patterns Discovered

#### Email Classification State Machine (OPS-035)

```
Pending → Classified | Uncertain | CourtUnassigned | Ignored
```

- `Pending` - Just synced, not yet processed
- `Classified` - Auto/manual assigned to case
- `Uncertain` - In NECLAR queue (unknown sender)
- `CourtUnassigned` - Court email without case match
- `Ignored` - Marked as not relevant

#### Classification Match Types

```typescript
enum ClassificationMatchType {
  Actor             // Matched sender/recipient in CaseActor
  ReferenceNumber   // Matched dosar nr or contract reference
  Keyword           // Matched case keywords
  Semantic          // AI semantic similarity
  GlobalSource      // Matched court/authority domain
  Manual            // User manually assigned
  ThreadContinuity  // Matched by conversation thread
}
```

#### Dosar Nr Extraction Patterns

**File:** `/Users/mio/Developer/bojin-law-2/services/ai-service/src/utils/reference-extractor.ts`

Production-ready regex patterns:

```typescript
const COURT_FILE_PATTERNS = [
  // With "dosar" prefix (highest confidence)
  /(?:dosar(?:ul)?|nr\.?\s*dosar)\s*(?:nr\.?\s*)?(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,

  // With "nr." prefix
  /(?<!\d)nr\.?\s*(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,

  // Standalone (lowest confidence)
  /(?<![/\d])(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})(?![/\d])/gi,
];
```

**Format:** `[number]/[court code]/[year]` (e.g., "1234/62/2024")

**Normalization:** Always convert to canonical form `XXXXX/Y/YYYY` for comparison.

#### Email Attachment Storage

- **Case-assigned emails:** OneDrive → `/Cases/{CaseNumber}/Emails/{YYYY-MM}/`
- **Uncategorized/Large (>100MB):** R2 → `email-attachments/{userId}/{emailId}/`
- **Auto-sync:** If `hasAttachments=true` but no records, sync on view

---

### Integration Research

#### PDF Parsing for Attachment Extraction

**Available libraries (already installed):**

- `pdf-parse@2.4.5` - Recommended for server-side text extraction
- `pdfjs-dist@5.4.296` - Core PDF.js library

**Recommended approach:** Lazy extraction

1. Extract text only when linking email to case (not every attachment)
2. Use `pdf-parse/node` for server-side extraction
3. Search extracted text for dosar nr patterns
4. Store in new field: `EmailAttachment.extractedText` (nullable)

**Performance:**

- ~500ms for 10-page PDF
- Max size: 50MB
- Timeout: 30 seconds

#### Delta Sync Investigation

**Current state:** Delta sync is implemented but has limitations with multi-folder support (OPS-291).

**Key findings:**

- Uses Microsoft Graph API `/me/messages` with `$deltatoken`
- Stores `deltaLink` in `EmailSyncState` per user
- Rate limit: 10,000 requests per 10 minutes
- Currently does full sync due to multi-folder complexity

**Webhook subscriptions:**

- Max lifetime: 4230 minutes (~2.9 days)
- Auto-renewal 30 minutes before expiry
- Dead-letter queue with exponential backoff

---

### Constraints Found

#### OPS-195 Removal (Multi-Case Confirmation)

**Fields to remove from EmailCaseLink:**

```diff
model EmailCaseLink {
  // Keep
  id, emailId, caseId, confidence, matchType
  linkedAt, linkedBy, isPrimary

  // Remove (OPS-195)
- needsConfirmation  Boolean
- isConfirmed        Boolean
- confirmedAt        DateTime?
- confirmedBy        String?
}
```

#### Database Schema Changes

**EmailCaseLink simplification:**

```sql
ALTER TABLE email_case_links DROP COLUMN needs_confirmation;
ALTER TABLE email_case_links DROP COLUMN is_confirmed;
ALTER TABLE email_case_links DROP COLUMN confirmed_at;
ALTER TABLE email_case_links DROP COLUMN confirmed_by;
```

**Email add suggested flag:**

```sql
ALTER TABLE emails ADD COLUMN is_suggested_assignment BOOLEAN DEFAULT false;
```

**Attachment text extraction (Phase 2):**

```sql
ALTER TABLE email_attachments ADD COLUMN extracted_text TEXT NULL;
ALTER TABLE email_attachments ADD COLUMN detected_case_number VARCHAR(50) NULL;
```

#### UI TODOs to Complete

1. Line 46 in email page: Get current user email from auth context
2. Line 77: Implement attachment preview modal
3. Line 82: Implement attachment download
4. Line 87: Wire send reply mutation (REPLY_TO_EMAIL)
5. Line 114: Wire send email mutation (SEND_EMAIL)
6. ComposeEmailModal line 282: Open case picker modal
7. ComposeEmailModal line 295: Save draft functionality

---

## Implementation Recommendation

### Phase 1: Core Wiring (Gateway exists, connect UI)

1. **Verify GraphQL resolvers exist** for all queries/mutations in `queries.ts`
2. **Wire email page handlers** - Connect existing hooks to UI actions
3. **Add auth context** - Replace hardcoded user email
4. **Test email sync** - Verify data flows from Graph API to UI

### Phase 2: Simplified Classification

1. **Remove OPS-195 fields** from EmailCaseLink model
2. **Simplify NECLAR** - Unknown sender only (not "uncertain")
3. **Add `isSuggestedAssignment`** flag to Email model
4. **Update classifiers** - Best-guess assignment, no blocking

### Phase 3: INSTANȚE Enhancement

1. **Port reference-extractor.ts** to gateway
2. **Add dosar nr extraction** from email subject/body
3. **Implement PDF fallback** - Parse attachments when body lacks dosar nr
4. **Auto-save court reference** - When user assigns court email to case

### Phase 4: UI Polish

1. **"Suggested" badge** on ThreadItem for AI assignments
2. **"Reassign" button** in ConversationHeader
3. **Case picker modal** for ComposeEmailModal
4. **Draft save** functionality

---

## File Plan

| File                                          | Action | Purpose                          |
| --------------------------------------------- | ------ | -------------------------------- |
| `src/app/(dashboard)/email/page.tsx`          | Modify | Wire handlers, add auth context  |
| `src/components/email/ThreadItem.tsx`         | Modify | Add "suggested" badge            |
| `src/components/email/ConversationHeader.tsx` | Modify | Add "Reassign" button            |
| `src/components/email/ComposeEmailModal.tsx`  | Modify | Add case picker                  |
| `src/graphql/queries.ts`                      | Verify | Ensure all queries match backend |
| Gateway: `email-case-link.model.ts`           | Modify | Remove confirmation fields       |
| Gateway: `email.model.ts`                     | Modify | Add isSuggestedAssignment        |
| Gateway: `reference-extractor.ts`             | Create | Port from ai-service             |
| Gateway: `pdf-attachment-parser.service.ts`   | Create | Text extraction service          |

---

## Risks

| Risk                          | Impact | Mitigation                   |
| ----------------------------- | ------ | ---------------------------- |
| Delta sync instability        | Medium | Full sync fallback exists    |
| PDF extraction performance    | Low    | Lazy extraction, size limits |
| Scanned PDFs (no OCR)         | Low    | Future enhancement           |
| Breaking existing bojin-law-2 | High   | Keep services compatible     |

---

## Next Step

Start a new session and run:

```
/plan research-email-sync
```
