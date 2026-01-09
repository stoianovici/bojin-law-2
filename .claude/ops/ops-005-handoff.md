# Handoff: [OPS-005] AI Extraction and Drafting Not Working

**Session**: 2
**Date**: 2025-12-10
**Status**: Fixing

## Work Completed This Session

### Fix 1: AI Extraction - Integrated ExtractedItemsPanel

**File**: `apps/web/src/app/communications/page.tsx`

- Replaced mock `ExtractedItemsSidebar` with working `ExtractedItemsPanel`
- Added `getSelectedThread()` from communication store to access selected thread's `caseId`
- Panel now receives `caseId` prop and queries real data via GraphQL (`usePendingExtractedItems`)
- Shows placeholder message when no thread/case is selected

### Fix 2: AI Drafting - Implemented AIDraftResponsePanel

**File**: `apps/web/src/components/communication/AIDraftResponsePanel.tsx`

Complete rewrite from stub to full implementation:

- Uses `useGenerateDraft` hook (already existed at `apps/web/src/hooks/useEmailDraft.ts`)
- Tone selection: Formal, Professional, Brief (with Romanian labels)
- "Generează draft" button calls `generateEmailDraft` GraphQL mutation
- "Folosește draft" opens compose modal with generated content
- "Copiază" copies draft to clipboard
- "Regenerează" regenerates with current tone
- Shows AI confidence indicator (color-coded)
- Handles loading and error states

## Current State

**Build Status**: ✅ Successful (verified with `npx next build --webpack`)

**What's Working**:

- Frontend code is complete and builds without errors
- GraphQL hooks exist and are properly typed
- Backend resolvers exist (`email-drafting.resolvers.ts`, `communication-intelligence.resolvers.ts`)

**What Needs Verification**:

1. **AI Service availability**: Backend calls `AI_SERVICE_URL` (default `localhost:3002`). Need to verify:
   - Is AI Service deployed on Render?
   - Is `AI_SERVICE_URL` env var configured in gateway?
   - Is `ANTHROPIC_API_KEY` configured in AI Service?

2. **Extracted items data**: ExtractedItemsPanel queries `extractedDeadlines`, etc.
   - Does the background worker (`communication-intelligence.worker.ts`) run in production?
   - Are there any extracted items in the database?
   - Check gateway logs for extraction worker activity

3. **Email-to-case association**: ExtractedItemsPanel requires `caseId` from thread
   - Are email threads properly linked to cases?
   - If threads have no `caseId`, the extraction panel will show placeholder

## Blockers/Questions

1. **AI Service Deployment**: Unknown if `services/ai-service` is deployed on Render
2. **Environment Variables**: Need to verify `AI_SERVICE_URL` is set in production gateway
3. **Background Worker**: Need to verify communication intelligence worker runs

## Next Steps

### Immediate (Deploy and Test)

1. Commit changes: `git add . && git commit -m "fix(OPS-005): integrate ExtractedItemsPanel and implement AIDraftResponsePanel"`
2. Push to trigger Render deploy
3. Test in production:
   - Go to `/communications`
   - Select an email thread
   - Expand "Sugestie răspuns AI" panel
   - Click "Generează draft"
   - Check browser console for errors

### If AI Drafting Fails

1. Check gateway logs for errors calling AI Service
2. Verify `AI_SERVICE_URL` env var on Render
3. Verify AI Service is deployed and healthy
4. Check `ANTHROPIC_API_KEY` is set in AI Service

### If Extraction Shows No Items

1. Check if threads have `caseId` assigned
2. Check if background worker is running (`communication-intelligence.worker.ts`)
3. Query database directly: `SELECT * FROM extracted_deadlines LIMIT 10;`
4. Manually trigger analysis on a thread

## Key Files

| File                                                                 | Status  | Description                         |
| -------------------------------------------------------------------- | ------- | ----------------------------------- |
| `apps/web/src/app/communications/page.tsx`                           | FIXED   | Now uses ExtractedItemsPanel        |
| `apps/web/src/components/communication/AIDraftResponsePanel.tsx`     | FIXED   | Full implementation                 |
| `apps/web/src/hooks/useEmailDraft.ts`                                | Working | GraphQL hooks for drafting          |
| `apps/web/src/hooks/useExtractedItems.ts`                            | Working | GraphQL hooks for extraction        |
| `services/gateway/src/graphql/resolvers/email-drafting.resolvers.ts` | Backend | Draft generation resolver           |
| `services/ai-service/`                                               | Unknown | AI service (needs deployment check) |

## Continue Command

```bash
/ops-continue 005
```
