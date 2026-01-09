# Handoff: [OPS-002] Legacy Import Stuck at 8k Docs

**Session**: 3
**Date**: 2025-12-08 15:00 UTC
**Status**: Verifying

## Work Completed This Session

### Root Cause Identified

The extraction process stopped at ~8K documents due to:

1. **Memory exhaustion**: `extractFromPSTFile()` loaded ALL document Buffers into memory at once
2. **Sequential processing**: Each document uploaded to R2 + text extracted (~1-2 sec/doc)
3. **Render timeout**: 10-minute request timeout kills the request at ~8K docs

### Fix Implemented: Resumable Batch Extraction

**1. Schema Update** (`packages/database/prisma/schema.prisma`)

- Added `extractionProgress` JSON field to track: `{totalInPst, extractedCount, isComplete}`

**2. PST Parser Updates** (`apps/legacy-import/src/services/pst-parser.service.ts`)

- Added `BatchExtractionOptions` interface with `skip` and `take` parameters
- Added `countDocumentsInPST()` - fast scan to count total docs without loading content
- Modified `processFolder()` to support skip/take for resumable extraction
- Modified `extractFromPSTFile()` to accept batch options

**3. API Updates** (`apps/legacy-import/src/app/api/extract-documents/route.ts`)

- First call: counts total documents in PST, saves to `extractionProgress`
- Subsequent calls: resumes from where it left off (skip already extracted docs)
- Processes ~500 docs per batch (EXTRACTION_BATCH_SIZE = 500)
- Returns progress: `{totalInPst, extractedCount, isComplete, remainingCount}`

**4. Frontend Updates** (`apps/legacy-import/src/app/page.tsx`)

- Updated `ExtractStep` component to support batch extraction with "Continue" button
- Added `ExtractionIncompleteBanner` component shown in categorize step when extraction incomplete
- Shows progress bar with extracted/total counts
- Allows users to continue extraction or proceed with partial data

## Current State

All code changes implemented. Ready for:

1. Database migration to add `extractionProgress` field
2. Deployment to Render
3. Testing with the actual 8K+ document PST file

## How It Works Now

1. User uploads PST file
2. First extraction call:
   - Downloads PST from R2 to temp file
   - Counts total supported documents (fast scan, no content loading)
   - Extracts first batch of ~500 docs
   - Uploads to R2, extracts text, creates DB records
   - Returns progress showing how many remain

3. User clicks "Continue Extraction" button:
   - Subsequent calls skip already-extracted docs
   - Extract next batch of ~500
   - Update progress in DB
   - Repeat until complete

4. When in Categorize step:
   - Yellow banner shows if extraction incomplete
   - Users can continue extraction or work with partial data

## Blockers/Questions

None currently. The implementation is backwards compatible:

- Existing sessions without `extractionProgress` will work (null progress = start fresh)
- Users can proceed with partial extraction if desired

## Next Steps

1. Run database migration: `npx prisma migrate dev --name add_extraction_progress`
2. Deploy changes to Render
3. Test resumable extraction:
   - Upload the same PST file that was stuck at 8K
   - Click "Continue Extraction" multiple times until complete
   - Verify all documents are extracted
4. If successful, close the issue

## Key Files Modified

| File                                                        | Change                                |
| ----------------------------------------------------------- | ------------------------------------- |
| `packages/database/prisma/schema.prisma`                    | Added `extractionProgress` JSON field |
| `apps/legacy-import/src/services/pst-parser.service.ts`     | Skip/take batch extraction            |
| `apps/legacy-import/src/app/api/extract-documents/route.ts` | Resumable extraction API              |
| `apps/legacy-import/src/app/page.tsx`                       | Batch extraction UI                   |

## Commands

Continue work: `/ops-continue ops-002`
