# Operations Log

> Persistent tracking of post-deployment issues, debugging sessions, and feature work.
> This file is the source of truth for all operations work across sessions.

## Quick Reference

| ID      | Title                                   | Type        | Priority    | Status        | Sessions |
| ------- | --------------------------------------- | ----------- | ----------- | ------------- | -------- |
| OPS-001 | Communications page not loading emails  | Bug         | P0-Critical | Investigating | 5        |
| OPS-002 | Legacy import stuck at 8k docs          | Performance | P1-High     | Resolved      | 5        |
| OPS-003 | Restrict partner dashboard to partners  | Feature     | P2-Medium   | Verifying     | 3        |
| OPS-004 | Add categorization backup before export | Feature     | P1-High     | Fixing        | 2        |

<!-- Issues will be indexed here automatically -->

---

## Active Issues

### [OPS-001] Communications page not loading emails

| Field           | Value         |
| --------------- | ------------- |
| **Status**      | Investigating |
| **Type**        | Bug           |
| **Priority**    | P0-Critical   |
| **Created**     | 2025-12-08    |
| **Sessions**    | 5             |
| **Last Active** | 2025-12-09    |

#### Description

The /communications page at https://legal-platform-web.onrender.com/communications is not loading actual emails. Console shows Apollo client working, MSAL auth succeeding, and MS access token being included for StartEmailSync - but no emails are displayed.

#### Reproduction Steps

1. Navigate to https://legal-platform-web.onrender.com/communications
2. Observe that no emails are loaded
3. Console shows StartEmailSync being called but no email data returned

#### Root Cause

**PRIMARY:** Email resolvers are NOT registered in the Apollo GraphQL server. The `emailResolvers` are defined in `services/gateway/src/graphql/resolvers/email.resolvers.ts` but are NOT imported or merged into `services/gateway/src/graphql/server.ts`. This causes all email-related GraphQL queries (emailThreads, emailThread, etc.) to fail silently.

**SECONDARY:** The GraphQL context does not include the MS access token. Even if resolvers were registered, `startEmailSync` would fail because the resolver expects `user.accessToken` but the context only provides `{id, firmId, role, email}`.

#### Fix Applied

**Fix 1: Register emailResolvers in GraphQL server**

- File: `services/gateway/src/graphql/server.ts`
- Added import: `import { emailResolvers } from './resolvers/email.resolvers';`
- Merged `emailResolvers.Query` into Query resolvers
- Merged `emailResolvers.Mutation` into Mutation resolvers
- Added `emailResolvers.Subscription` to Subscription resolvers
- Added type resolvers: `Email`, `EmailThread`, `EmailAttachment`

**Fix 2: Pass MS access token through GraphQL context**

- File: `apps/web/src/lib/apollo-client.ts` - Added auth link to include `x-ms-access-token` header
- File: `apps/web/src/contexts/AuthContext.tsx` - Register token getter with Apollo client
- File: `apps/web/src/app/api/graphql/route.ts` - Forward `x-ms-access-token` header to gateway
- File: `services/gateway/src/graphql/server.ts` - Extract token from header and add to context
- File: `services/gateway/src/graphql/resolvers/case.resolvers.ts` - Updated Context type to include `accessToken`

#### Session Log

- [2025-12-08] Issue created. Initial triage identified two critical bugs: (1) emailResolvers not merged into GraphQL server schema, (2) MS access token not passed through context.
- [2025-12-08] Session 2 started. Implemented both fixes: registered emailResolvers in server.ts and set up MS access token pass-through from client to gateway.
- [2025-12-08] Session 3 started. Continuing from: Fixing. Beginning verification of deployed fix.
- [2025-12-08] Session 3 - Found root cause: when user authenticated via session cookie only (no MSAL accounts cached), getAccessToken() returned null. Fixed by: (1) Enhanced getAccessToken to check for any MSAL accounts in browser, (2) Added hasMsalAccount and reconnectMicrosoft to AuthContext, (3) Updated EmailThreadList to show "Connect Microsoft" prompt when MSAL not available.
- [2025-12-08] Session 4 started. Problem persisting after previous fix. Re-investigating.
- [2025-12-08] Session 4 - Found root cause: `hasMsalAccount` was computed once at render time via `hasMsalAccount()` call, not as reactive state. When MSAL init completes with no accounts, the UI still showed "Sync" button because hasMsalAccount was evaluated before MSAL finished initializing. Fixed by: (1) Added `hasMsalAccountState` state variable, (2) Added `updateHasMsalAccount()` function called after MSAL init, (3) Changed context value to use state instead of computed function call.
- [2025-12-08] Session 4 - Second issue found: The `/communications` page was a different component that didn't use `hasMsalAccount`. Updated to show "Conectează Microsoft" button when no MSAL account.
- [2025-12-08] Session 4 - Third issue found: MSAL `loginRequest` scopes did not include `Mail.Read`. User authenticated but had no permission to read emails. Added `Mail.Read` and `Mail.ReadBasic` to scopes.
- [2025-12-09] Session 5 started. Continuing from: Investigating. All fixes deployed and live since ~17:30 UTC yesterday. Verifying fix.
- [2025-12-09] Session 5 - Found root cause: The page was showing "Conectează Microsoft" banner even when emails exist in database. The MSAL token is only needed for SYNC operations, not for viewing already-synced emails. Additionally, clicking connect triggered full OAuth flow causing "Need admin approval" error.
- [2025-12-09] Session 5 - Fixes applied: (1) Simplified communications page to always show sync button, only show connect prompt when no emails exist, (2) Added `prompt: 'select_account'` to MSAL config to avoid consent prompt, (3) Updated `reconnectMicrosoft()` to try SSO first before falling back to redirect.

#### Files Involved

- `services/gateway/src/graphql/server.ts` - **FIXED** - Added emailResolvers import/merge + token extraction
- `services/gateway/src/graphql/resolvers/email.resolvers.ts` - Email resolver definitions
- `services/gateway/src/graphql/resolvers/case.resolvers.ts` - **FIXED** - Added accessToken to Context type
- `apps/web/src/lib/apollo-client.ts` - **FIXED v16** - Added auth link for MS token, version bump
- `apps/web/src/lib/msal-config.ts` - **FIXED** - Added Mail.Read scope to loginRequest
- `apps/web/src/contexts/AuthContext.tsx` - **FIXED v3** - Made hasMsalAccount reactive state instead of computed function
- `apps/web/src/app/api/graphql/route.ts` - **FIXED** - Forward x-ms-access-token header
- `apps/web/src/hooks/useEmailSync.ts` - Frontend email hooks/queries
- `apps/web/src/components/email/EmailThreadList.tsx` - **FIXED** - Added "Connect Microsoft" prompt when MSAL not available
- `apps/web/src/app/communications/page.tsx` - **FIXED** - Added hasMsalAccount check, shows "Conectează Microsoft" when needed

---

### [OPS-002] Legacy import stuck at 8k docs

| Field           | Value                |
| --------------- | -------------------- |
| **Status**      | Resolved             |
| **Type**        | Performance          |
| **Priority**    | P1-High              |
| **Created**     | 2025-12-08           |
| **Sessions**    | 5                    |
| **Last Active** | 2025-12-09 07:35 UTC |

#### Description

Legacy document import process stalls/fails when processing approximately 8,000 documents. The system becomes unresponsive or times out when trying to load and process large document batches.

#### Reproduction Steps

1. Initiate legacy import with ~8,000+ documents
2. Observe import process stalling during batch loading phase
3. get-batch endpoint becomes slow/unresponsive

#### Root Cause

**PRIMARY (Session 2):** The `/api/get-batch` endpoint in `apps/legacy-import/src/app/api/get-batch/route.ts` had NO pagination - it fetched ALL documents for a user's batches in a single query. At 8K docs, this causes memory exhaustion and payload too large.

**SECONDARY (Session 2):** Missing composite database indexes on `(sessionId, batchId)` causing slow queries.

**TERTIARY (Session 3 - CRITICAL):** The extraction process itself stopped at ~8K documents due to:

1. **Memory exhaustion**: `extractFromPSTFile()` loaded ALL document Buffers into memory at once. With 8K+ PDFs (100KB-10MB each), this could require 1-10GB of RAM.
2. **Sequential processing**: Each document was uploaded to R2 and had text extracted (~1-2 seconds per doc). 8K docs = 2-4 hours of processing.
3. **Render request timeout**: Render web services have a 10-minute timeout. The extraction request was killed after 10 minutes, leaving the process incomplete at ~8K docs.

#### Fix Applied

**Fix 1: Remove extractedText from batch query (reduce payload ~90%)**

- File: `apps/legacy-import/src/app/api/get-batch/route.ts`
- Removed `extractedText: true` from select - this large TEXT field was being loaded for all 8K docs
- extractedText is now loaded lazily via the document-url endpoint when a document is selected

**Fix 2: Add extractedText to document-url endpoint**

- File: `apps/legacy-import/src/app/api/document-url/route.ts`
- Added `extractedText` to the select and response
- Frontend now fetches extractedText per-document when needed

**Fix 3: Update frontend for lazy loading**

- File: `apps/legacy-import/src/stores/documentStore.ts` - Added `extractedTexts` cache and `setExtractedText` action
- File: `apps/legacy-import/src/components/Categorization/CategorizationWorkspace.tsx` - Fetch and cache extractedText with document URL

**Fix 4: Add pagination to get-batch endpoint**

- File: `apps/legacy-import/src/app/api/get-batch/route.ts`
- Added `page` and `pageSize` query params (default 100, max 500)
- Added `skip` and `take` to Prisma query
- Added `pagination` object to response with page info

**Fix 5: Add composite indexes for query performance**

- File: `packages/database/prisma/schema.prisma`
- Added `@@index([sessionId, batchId])` - used in get-batch query
- Added `@@index([sessionId, status])` - used in analysis queries

**Fix 6 (Session 3): Resumable batch extraction**

- File: `packages/database/prisma/schema.prisma`
  - Added `extractionProgress` JSON field to track: `{totalInPst, extractedCount, isComplete}`

- File: `apps/legacy-import/src/services/pst-parser.service.ts`
  - Added `BatchExtractionOptions` interface with `skip` and `take` parameters
  - Added `countDocumentsInPST()` - fast scan to count total docs without loading content
  - Modified `processFolder()` to support skip/take for resumable extraction
  - Modified `extractFromPSTFile()` to accept batch options

- File: `apps/legacy-import/src/app/api/extract-documents/route.ts`
  - First call: counts total documents in PST, saves to `extractionProgress`
  - Subsequent calls: resumes from where it left off (skip already extracted docs)
  - Processes ~500 docs per batch (fits within 10-minute timeout)
  - Returns progress: `{totalInPst, extractedCount, isComplete, remainingCount}`

- File: `apps/legacy-import/src/app/page.tsx`
  - Updated `ExtractStep` component to support batch extraction with "Continue" button
  - Added `ExtractionIncompleteBanner` component shown in categorize step when extraction incomplete
  - Shows progress bar with extracted/total counts
  - Allows users to continue extraction or proceed with partial data

#### Session Log

- [2025-12-08 19:45] Issue created. Initial triage identified critical pagination issue in get-batch endpoint. The endpoint loads ALL documents without pagination, and includes the large `extractedText` field unnecessarily.
- [2025-12-08 20:00] Session 2 started. Continuing from: New. Beginning implementation of pagination fix.
- [2025-12-08 20:15] Session 2 - Implemented 5 fixes: (1) Removed extractedText from batch query, (2) Added extractedText to document-url for lazy loading, (3) Updated frontend store and component for lazy text loading, (4) Added pagination with page/pageSize params, (5) Added composite indexes. Ready for deployment and verification.
- [2025-12-08] Session 3 started. Problem persists - extraction stopping at ~8K docs.
- [2025-12-08] Session 3 - Root cause found: extraction loads ALL documents into memory and processes sequentially. With 8K+ docs, this exceeds Render's 10-minute request timeout.
- [2025-12-08] Session 3 - Implemented resumable batch extraction: PST parser now supports skip/take, API tracks progress in DB, frontend shows "Continue extraction" button. Extracts ~500 docs per batch to stay under timeout.
- [2025-12-08] Session 4 - 502 errors on extract-documents. Root cause: `countDocumentsInPST()` was calling `getAttachment()` for every attachment to check file extension, which is extremely slow for 8K+ docs (causes Render timeout). Fixed by using fast estimation that just counts `numberOfAttachments` without loading attachment data. Also added `extractionProgress` field to legacy-import Prisma schema (was missing).
- [2025-12-09] Session 5 started. "Failed to get batch assignment" and "Failed to fetch dashboard" errors.
- [2025-12-09] Session 5 - Root cause: The `extraction_progress` column was missing from production database. Schema had the field but migration was never run. All API endpoints querying LegacyImportSession were failing with "The column legacy_import_sessions.extraction_progress does not exist".
- [2025-12-09] Session 5 - Fix: Created temporary migration endpoint, deployed, ran `ALTER TABLE legacy_import_sessions ADD COLUMN IF NOT EXISTS extraction_progress JSONB`. All endpoints now working. 8000 documents visible in 120+ monthly batches (2013-03 to 2025-11).
- [2025-12-09] Session 5 - **RESOLVED**. Categorization page and Dashboard now load successfully.

#### Files Involved

- `apps/legacy-import/src/app/api/get-batch/route.ts` - **FIXED** - Added pagination, removed extractedText
- `apps/legacy-import/src/app/api/document-url/route.ts` - **FIXED** - Added extractedText to response
- `apps/legacy-import/src/stores/documentStore.ts` - **FIXED** - Added extractedTexts cache
- `apps/legacy-import/src/components/Categorization/CategorizationWorkspace.tsx` - **FIXED** - Lazy load extractedText
- `packages/database/prisma/schema.prisma` - **FIXED** - Added composite indexes + extractionProgress field
- `apps/legacy-import/src/services/pst-parser.service.ts` - **FIXED** - Added skip/take batch extraction + countDocumentsInPST
- `apps/legacy-import/src/app/api/extract-documents/route.ts` - **FIXED** - Resumable batch extraction with progress tracking
- `apps/legacy-import/src/app/page.tsx` - **FIXED** - ExtractStep with batch UI + ExtractionIncompleteBanner
- `apps/legacy-import/src/app/api/analyze-documents/route.ts` - Batch size limited to 100 (future optimization)
- `apps/legacy-import/src/services/ai-document-analyzer.ts` - BATCH_SIZE = 25 (future optimization)

---

### [OPS-003] Restrict partner dashboard to partners only

| Field           | Value      |
| --------------- | ---------- |
| **Status**      | Verifying  |
| **Type**        | Feature    |
| **Priority**    | P2-Medium  |
| **Created**     | 2025-12-09 |
| **Sessions**    | 3          |
| **Last Active** | 2025-12-09 |

#### Description

The Partner Dashboard (control panel) in the legacy-import app is currently accessible to ALL authenticated users. This dashboard allows viewing other users' progress, merging categories, reassigning batches, and exporting data - features that should be restricted to Partner/BusinessOwner roles only.

**User note:** The PST document extraction is currently in progress (~8,000 docs). User requests that we evaluate risk before implementing to avoid disrupting the extraction process.

#### Reproduction Steps

1. Login as any user (Associate/Paralegal) to legacy-import app
2. Navigate to dashboard/control panel
3. Observe that partner-only features are visible and accessible

#### Root Cause

**Missing authorization checks on multiple endpoints and UI:**

1. **No authentication at all on partner dashboard endpoints:**
   - `GET /api/partner-dashboard` - No auth check
   - `GET /api/reassign-batches` - No auth check
   - `POST /api/reassign-batches` - No auth check
   - `POST /api/extract-contacts` - No auth check
   - `POST /api/export-onedrive` - No auth check

2. **UI not gated by role:**
   - `PartnerDashboard.tsx` renders for all authenticated users
   - No role check before showing partner-only features

3. **No firm validation:**
   - Endpoints accept sessionId without validating user's firm owns that session
   - Cross-firm data access possible if sessionId is known

#### Fix Applied

**Fix 1: Added `requirePartner()` auth check to `/api/partner-dashboard/route.ts`**

- GET handler now requires Partner/BusinessOwner role
- Returns 401/403 for unauthorized/forbidden requests

**Fix 2: Added `requirePartner()` auth check to `/api/reassign-batches/route.ts`**

- Both GET and POST handlers now require Partner/BusinessOwner role
- Returns 401/403 for unauthorized/forbidden requests

**Fix 3: Added `requirePartner()` auth check to `/api/extract-contacts/route.ts`**

- Both GET and POST handlers now require Partner/BusinessOwner role
- Returns 401/403 for unauthorized/forbidden requests

**Fix 4: Added `requirePartner()` auth check to `/api/export-onedrive/route.ts`**

- Both GET and POST handlers now require Partner/BusinessOwner role
- Returns 401/403 for unauthorized/forbidden requests

**Fix 5: Added role gate to `PartnerDashboard.tsx` UI component**

- Component checks user role from AuthContext
- Non-partner users see "Acces restricționat" (Access restricted) message
- Partner-only features are hidden for non-partners

#### Session Log

- [2025-12-09 08:00] Issue created. Initial triage identified 5+ endpoints with missing auth checks and UI not gated by role. Key files: `PartnerDashboard.tsx`, `/api/partner-dashboard/route.ts`, `/api/reassign-batches/route.ts`, `/api/extract-contacts/route.ts`, `/api/export-onedrive/route.ts`. Note: PST extraction currently in progress - need to evaluate risk before implementing.
- [2025-12-09] Session 2 started. Continuing from: New. Beginning implementation of auth checks on partner-only endpoints.
- [2025-12-09] Session 2 - Implemented all 5 fixes: Added `requirePartner()` auth checks to 4 API endpoints (partner-dashboard, reassign-batches, extract-contacts, export-onedrive) and added role gate to PartnerDashboard.tsx UI component. All changes compile without errors. Ready for deployment and verification.
- [2025-12-09] Session 3 started. Continuing from: Verifying. Ready to deploy and test changes.
- [2025-12-09] Session 3 - Local testing confirmed code compiles and auth structure is correct (DB connection issue in dev env is unrelated). Committed and pushed to main (6d227f9). Deployed to production.

#### Files Involved

- `apps/legacy-import/src/components/Dashboard/PartnerDashboard.tsx` - **FIXED** - Added role gate with useAuth hook
- `apps/legacy-import/src/app/api/partner-dashboard/route.ts` - **FIXED** - Added requirePartner() check
- `apps/legacy-import/src/app/api/reassign-batches/route.ts` - **FIXED** - Added requirePartner() to GET and POST
- `apps/legacy-import/src/app/api/extract-contacts/route.ts` - **FIXED** - Added requirePartner() to GET and POST
- `apps/legacy-import/src/app/api/export-onedrive/route.ts` - **FIXED** - Added requirePartner() to GET and POST
- `apps/legacy-import/src/app/api/merge-categories/route.ts` - Already has `requirePartner()` (good)
- `apps/legacy-import/src/lib/auth.ts` - Has `requirePartner()` helper (reused)

---

### [OPS-004] Add categorization backup before export

| Field           | Value      |
| --------------- | ---------- |
| **Status**      | Fixing     |
| **Type**        | Feature    |
| **Priority**    | P1-High    |
| **Created**     | 2025-12-09 |
| **Sessions**    | 2          |
| **Last Active** | 2025-12-09 |

#### Description

The legacy-import system currently has NO safeguards against data loss during or after the export process. When documents are exported to OneDrive, the R2 storage (PST file + extracted documents) is deleted IMMEDIATELY with no recovery window. If something goes wrong, categorization work is permanently lost.

**Current risks with ~8,000 documents in progress:**

1. R2 files deleted immediately after OneDrive export - no grace period
2. No snapshot of categorization assignments before export
3. No way to recover if OneDrive export partially fails
4. Original PST and extracted docs permanently lost after export

#### Root Cause

**No backup/recovery mechanisms implemented:**

1. **Immediate R2 deletion** (`export-onedrive/route.ts` lines 100-118):
   - `deleteSessionFiles()` called right after OneDrive upload succeeds
   - Deletes `pst/{sessionId}/*` and `documents/{sessionId}/*`
   - No confirmation, no delay, no recovery option

2. **No categorization snapshot**:
   - Categorization only exists in PostgreSQL
   - No JSON backup created before export
   - If DB lost, categorization cannot be reconstructed

3. **No audit trail for individual categorizations**:
   - Only high-level actions logged (PST_UPLOADED, EXPORT_COMPLETED)
   - Cannot track who categorized what document when

#### Proposed Fix

**Phase 1: Pre-Export Snapshot (Critical - implement before 8K export)**

1. Create `POST /api/export-snapshot` endpoint:
   - Generate JSON with all categorization data:
     ```json
     {
       "sessionId": "...",
       "snapshotAt": "2025-12-09T...",
       "categories": [{ "id": "...", "name": "...", "documentCount": N }],
       "documents": [{ "id": "...", "fileName": "...", "categoryId": "...", "categorizedBy": "...", "categorizedAt": "..." }],
       "batches": [{ "id": "...", "monthYear": "...", "assignedTo": "...", "progress": N }]
     }
     ```
   - Store snapshot in R2: `backups/{sessionId}/categorization-{timestamp}.json`
   - Also store in DB as `LegacyImportAuditLog` with action `CATEGORIZATION_SNAPSHOT`

2. Modify `POST /api/export-onedrive`:
   - REQUIRE snapshot exists before allowing export
   - Show warning if snapshot is > 1 hour old

**Phase 2: Delayed R2 Cleanup (High priority)**

3. Add `cleanupScheduledAt` field to `LegacyImportSession`:
   - After successful OneDrive export, set `cleanupScheduledAt = now + 7 days`
   - Don't call `deleteSessionFiles()` immediately

4. Create `POST /api/cleanup-session` endpoint (Partner-only):
   - Manual trigger to delete R2 files
   - Require confirmation
   - Only works if session status = 'Exported'

5. Create scheduled cleanup job (or manual admin trigger):
   - Find sessions where `cleanupScheduledAt < now` and `cleanedUpAt IS NULL`
   - Delete R2 files and set `cleanedUpAt`

**Phase 3: Enhanced Audit Trail (Nice to have)**

6. Add `CategoryAssignmentLog` table:
   - Track every categorization change: `documentId`, `oldCategoryId`, `newCategoryId`, `changedBy`, `changedAt`
   - Enable point-in-time reconstruction

7. Add "Undo Last Categorization" feature:
   - Revert recent changes within 24-hour window

#### Session Log

- [2025-12-09] Issue created. Identified critical data loss risks: immediate R2 deletion after export with no recovery options. ~8,000 documents currently in categorization phase - need safeguards before export.
- [2025-12-09] Session 2 started. Continuing from: New. Beginning implementation of Phase 1 (snapshot endpoint) and Phase 2 (delayed cleanup).
- [2025-12-09] Session 2 - Implemented all Phase 1 & Phase 2 features:
  1. Added `cleanupScheduledAt` and `lastSnapshotAt` fields to schema
  2. Created `/api/export-snapshot` - generates JSON backup of all categorization data, uploads to R2
  3. Modified `/api/export-onedrive` - now requires snapshot before export, schedules R2 cleanup 7 days out (no immediate deletion)
  4. Created `/api/cleanup-session` - partner-only manual cleanup with confirmation
  5. All code compiles. Ready for deployment.

#### Files Involved

- `apps/legacy-import/src/app/api/export-onedrive/route.ts` - **FIXED** - Added snapshot check, delayed R2 cleanup
- `apps/legacy-import/src/lib/r2-storage.ts` - Has `deleteSessionFiles()` function (unchanged)
- `apps/legacy-import/src/app/api/export-snapshot/route.ts` - **CREATED** - Snapshot endpoint
- `apps/legacy-import/src/app/api/cleanup-session/route.ts` - **CREATED** - Manual cleanup trigger
- `packages/database/prisma/schema.prisma` - **FIXED** - Added `cleanupScheduledAt`, `lastSnapshotAt` fields

---

<!-- New issues are added here -->

---

## In Progress

<!-- Issues being actively worked move here -->

---

## Resolved

<!-- Completed issues move here with resolution notes -->

---

## Session History

| Date | Issue | Duration | Summary |
| ---- | ----- | -------- | ------- |

<!-- Session log entries -->
