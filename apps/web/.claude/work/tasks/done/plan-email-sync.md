# Plan: Email Processing and Sync

**Status**: Approved
**Date**: 2024-12-29
**Input**: `research-email-sync.md`
**Next step**: `/implement plan-email-sync`

---

## Context Summary

**Projects:**

- `bojin-law-ui` at `/Users/mio/Developer/bojin-law-ui` - New Next.js 16 frontend with Linear design
- `bojin-law-2` at `/Users/mio/Developer/bojin-law-2` - Backend monorepo with gateway at localhost:4000

**Tech Stack:** Next.js 16, TypeScript, Apollo Client, Zustand, Prisma, PostgreSQL

**Key Files:**

- Schema: `/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma`
- Email page: `/Users/mio/Developer/bojin-law-ui/src/app/(dashboard)/email/page.tsx`
- GraphQL queries: `/Users/mio/Developer/bojin-law-ui/src/graphql/queries.ts`
- Reference extractor source: `/Users/mio/Developer/bojin-law-2/services/ai-service/src/utils/reference-extractor.ts`

## Approach Summary

Simplify email classification by removing OPS-195 confirmation blocking, add "suggested assignment" visual indicator, wire the existing UI components to backend mutations, and port dosar nr extraction for court email matching. The 12 email UI components are already built - this plan focuses on connecting them to the backend and simplifying the classification flow.

---

## Parallel Group 1: Schema Changes

> These tasks modify the Prisma schema - run sequentially since they touch the same file

### Task 1.1: Remove OPS-195 confirmation fields from EmailCaseLink

- **File**: `/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Remove these fields from `EmailCaseLink` model:
  - `needsConfirmation Boolean @default(false) @map("needs_confirmation")`
  - `isConfirmed Boolean @default(true) @map("is_confirmed")`
  - `confirmedAt DateTime? @map("confirmed_at")`
  - `confirmedBy String? @map("confirmed_by")`
- **Done when**: EmailCaseLink model has only: id, emailId, caseId, confidence, matchType, linkedAt, linkedBy, isPrimary

### Task 1.2: Add isSuggestedAssignment to Email model

- **File**: `/Users/mio/Developer/bojin-law-2/packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add field to `Email` model after `classifiedBy`:
  ```prisma
  isSuggestedAssignment Boolean @default(false) @map("is_suggested_assignment") // AI-assigned, may need review
  ```
- **Done when**: Email model has `isSuggestedAssignment` field

---

## Sequential: After Schema Changes

### Task 2: Generate Prisma migration

- **Depends on**: Task 1.1, 1.2
- **File**: `/Users/mio/Developer/bojin-law-2/packages/database/prisma/migrations/` (CREATE)
- **Do**:
  1. `cd /Users/mio/Developer/bojin-law-2/packages/database`
  2. `npx prisma migrate dev --name remove_ops195_add_suggested_assignment`
  3. Verify migration SQL removes columns and adds new field
- **Done when**: Migration created and applied successfully, `npx prisma generate` completes

---

## Parallel Group 2: UI Wiring

> These tasks run simultaneously via sub-agents - each touches a different file

### Task 3.1: Wire email page handlers and auth context

- **File**: `/Users/mio/Developer/bojin-law-ui/src/app/(dashboard)/email/page.tsx` (MODIFY)
- **Do**:
  1. Import `useAuth` hook and replace hardcoded `userEmail` (line 47) with auth context
  2. Wire `handleSendReply` (line 86) to call `REPLY_TO_EMAIL` mutation
  3. Wire `handleSendNewEmail` (line 106) to call `SEND_EMAIL` mutation
  4. Import necessary mutations from `@/graphql/queries`
- **Done when**: Send reply and send email actually call GraphQL mutations, user email comes from auth

### Task 3.2: Add "suggested" badge to ThreadItem

- **File**: `/Users/mio/Developer/bojin-law-ui/src/components/email/ThreadItem.tsx` (MODIFY)
- **Do**:
  1. Add `isSuggestedAssignment?: boolean` to `ThreadPreview` type or props
  2. Show badge next to sender name when `isSuggestedAssignment` is true:
     ```tsx
     {
       thread.isSuggestedAssignment && (
         <span className="px-1.5 py-0.5 text-xs bg-linear-warning/20 text-linear-warning rounded">
           Sugerat
         </span>
       );
     }
     ```
- **Done when**: ThreadItem shows "Sugerat" badge for AI-assigned threads

### Task 3.3: Add "Reassign" button to ConversationHeader

- **File**: `/Users/mio/Developer/bojin-law-ui/src/components/email/ConversationHeader.tsx` (MODIFY)
- **Do**:
  1. Add `onReassign?: () => void` prop
  2. Add "Reasignează" button next to existing actions:
     ```tsx
     <Button variant="ghost" size="sm" onClick={onReassign}>
       <RefreshCw className="w-4 h-4 mr-1" />
       Reasignează
     </Button>
     ```
  3. Import RefreshCw from lucide-react
- **Done when**: ConversationHeader has Reassign button that triggers callback

### Task 3.4: Wire ComposeEmailModal case picker and draft save

- **File**: `/Users/mio/Developer/bojin-law-ui/src/components/email/ComposeEmailModal.tsx` (MODIFY)
- **Do**:
  1. Wire case picker button (line ~282) to open a case selection dropdown/modal
  2. Add draft save functionality (line ~295) using localStorage or mutation
  3. Use existing `GET_EMAILS_BY_CASE` query to populate case list for picker
- **Done when**: User can select a case for the email and save drafts

---

## Parallel Group 3: Backend Services

> These tasks run simultaneously via sub-agents

### Task 4.1: Port reference-extractor to gateway

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/utils/reference-extractor.ts` (CREATE)
- **Do**:
  1. Copy patterns from `/Users/mio/Developer/bojin-law-2/services/ai-service/src/utils/reference-extractor.ts`
  2. Export `extractCourtFileNumbers(text: string): string[]` function
  3. Export `normalizeCourtFileNumber(raw: string): string` function
  4. Add unit tests in `reference-extractor.test.ts`
- **Done when**: Gateway has working dosar nr extraction with tests passing

### Task 4.2: Create PDF attachment parser service

- **File**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/services/pdf-attachment-parser.service.ts` (CREATE)
- **Do**:
  1. Use `pdf-parse` (already installed) to extract text from PDF buffers
  2. Create `PdfAttachmentParserService` class with:
     - `extractText(buffer: Buffer): Promise<string>` - extracts text from PDF
     - `extractCourtFileNumbers(buffer: Buffer): Promise<string[]>` - uses reference-extractor
  3. Add timeout (30s) and size limit (50MB)
  4. Handle errors gracefully (return empty string on failure)
- **Done when**: Service can extract text and dosar numbers from PDF attachments

---

## Parallel Group 4: Classification Simplification

> Run after Group 3 since it depends on reference-extractor

### Task 5.1: Simplify email classification service

- **File**: `/Users/mio/Developer/bojin-law-2/services/ai-service/src/services/email-classification.service.ts` (MODIFY)
- **Do**:
  1. Remove all `needsConfirmation` / `isConfirmed` logic
  2. Update classification to set `isSuggestedAssignment = true` when confidence < 0.8
  3. Integrate dosar nr extraction from email subject/body for court emails
  4. Update NECLAR logic: only unknown sender goes to uncertain queue (not low confidence)
- **Done when**: Classification flow simplified, no confirmation blocking, suggested flag set appropriately

---

## Final Steps (Sequential)

### Task 6: Integration Testing

- **Depends on**: All previous tasks
- **Do**:
  1. Start gateway: `cd bojin-law-2 && pnpm dev`
  2. Start UI: `cd bojin-law-ui && pnpm dev`
  3. Test sync flow: Trigger email sync, verify emails appear in UI
  4. Test classification: Send test email, verify it gets assigned with "Sugerat" badge
  5. Test reply: Send reply from UI, verify it appears in thread
  6. Test court email: Verify dosar nr extraction works
- **Done when**: Full flow works end-to-end, no blocking confirmations

---

## Session Scope Assessment

- **Total tasks**: 10
- **Estimated complexity**: Medium-Complex
- **Checkpoint recommended at**: After Group 2 (UI wiring complete) - natural breakpoint before backend changes

## File Ownership Summary

| File                               | Task                  |
| ---------------------------------- | --------------------- |
| `schema.prisma`                    | 1.1, 1.2 (sequential) |
| `email/page.tsx`                   | 3.1                   |
| `ThreadItem.tsx`                   | 3.2                   |
| `ConversationHeader.tsx`           | 3.3                   |
| `ComposeEmailModal.tsx`            | 3.4                   |
| `reference-extractor.ts` (gateway) | 4.1                   |
| `pdf-attachment-parser.service.ts` | 4.2                   |
| `email-classification.service.ts`  | 5.1                   |

## Next Step

Start a new session and run:

```
/implement plan-email-sync
```
