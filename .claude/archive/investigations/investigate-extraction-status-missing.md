# Investigation: Document Creation Fails - Missing `extraction_status` Column

**Slug**: extraction-status-missing
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug extraction-status-missing` to implement fix

---

## Bug Summary

**Reported symptom**: Creating a new document from the documents page fails with error: "The column `extraction_status` does not exist in the current database"

**Reproduction steps**:

1. Navigate to http://localhost:3000/documents
2. Click to create a new document
3. Enter a document name (e.g., "CIM 2")
4. Click "Creează și deschide în Word"

**Expected behavior**: Document is created and opens in Word

**Actual behavior**: Error message: `Invalid 'tx.document.create()' invocation... The column 'extraction_status' does not exist in the current database`

**Frequency**: Always (100% reproducible)

---

## Root Cause Analysis

### The Bug

**Root cause**: Schema drift between the Prisma schema and the `legal_platform` database. The extraction-related columns were added to the schema but no migration was created/applied to the active database.

**Location**: `packages/database/prisma/schema.prisma:559-563` (uncommitted changes)

**Code path**:

```
User clicks "Create" → CreateBlankDocument mutation → document.resolvers.ts:3725 → tx.document.create() → Prisma attempts to insert with extractionStatus default → Column doesn't exist in DB → Error
```

**Type**: Schema/Data bug - Database schema is out of sync with Prisma client expectations

### Why It Happens

The extraction fields were added to the Prisma schema as **uncommitted local changes**:

```diff
+  extractedContent         String?                     @map("extracted_content")
+  extractedContentUpdatedAt DateTime?                  @map("extracted_content_updated_at") @db.Timestamptz(6)
+  extractionStatus         DocumentExtractionStatus    @default(NONE) @map("extraction_status")
+  extractionError          String?                     @map("extraction_error") @db.VarChar(500)
+  processWithAI            Boolean                     @default(false) @map("process_with_ai")
```

And a new enum:

```diff
+enum DocumentExtractionStatus {
+  NONE
+  PENDING
+  PROCESSING
+  COMPLETED
+  FAILED
+  UNSUPPORTED
+}
```

**Database state comparison:**

| Database                  | Has extraction columns? | Has \_prisma_migrations? |
| ------------------------- | ----------------------- | ------------------------ |
| `legal_platform` (active) | NO                      | NO                       |
| `legal_platform_seed`     | YES                     | YES                      |

The active `legal_platform` database:

- Has NO `_prisma_migrations` table (was likely set up differently)
- Is missing 5 columns: `extracted_content`, `extracted_content_updated_at`, `extraction_status`, `extraction_error`, `process_with_ai`
- Is missing the `DocumentExtractionStatus` enum

The `legal_platform_seed` database has all these because migrations were properly applied to it.

### Additional Context: VS Code Crashes

The user mentioned VS Code crashed twice while working on this. This could be related to:

1. Resource-intensive TypeScript operations (large schema changes)
2. Prisma client regeneration taking excessive memory
3. The database package's `tsc --watch` process spinning while schema changes were made
4. Unrelated VS Code extension issues

The VS Code crashes are likely a symptom of working with large schema files and regenerating Prisma clients, not a direct cause of the bug.

### Why It Wasn't Caught

1. **Migrations not created**: The schema changes were made but no `prisma migrate dev` was run to create a migration
2. **Wrong database tested**: Someone may have tested against `legal_platform_seed` (which works) while the app uses `legal_platform`
3. **db push vs migrate**: The columns may have been added to `legal_platform_seed` via `prisma db push` which doesn't create migration files
4. **No local test coverage**: The document creation flow wasn't tested after schema changes

---

## Impact Assessment

**Affected functionality**:

- Creating new blank documents
- Any document creation or update that touches the `Document` model with default values
- Content extraction worker (uses `extractionStatus` field)

**Blast radius**: Moderate - Document creation is blocked but existing documents can still be viewed

**Related code**:

- `services/gateway/src/graphql/resolvers/document.resolvers.ts`: Document CRUD
- `services/gateway/src/workers/content-extraction.worker.ts`: Uses `DocumentExtractionStatus` enum
- `services/gateway/src/services/content-extraction.service.ts`: Content extraction logic

**Risk of similar bugs**: Medium - Schema drift can happen again if migrations aren't properly created

---

## Proposed Fix Approaches

### Option A: Create Migration for Extraction Fields (Recommended)

**Approach**: Create a proper Prisma migration to add the missing columns to the database

**Files to change**:

1. Create new migration file via `prisma migrate dev --name add_extraction_fields`
2. Apply migration to `legal_platform` database

**Migration SQL needed**:

```sql
-- Create enum
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

-- Add columns to documents table
ALTER TABLE "documents" ADD COLUMN "extracted_content" TEXT;
ALTER TABLE "documents" ADD COLUMN "extracted_content_updated_at" TIMESTAMPTZ(6);
ALTER TABLE "documents" ADD COLUMN "extraction_status" "DocumentExtractionStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "documents" ADD COLUMN "extraction_error" VARCHAR(500);
ALTER TABLE "documents" ADD COLUMN "process_with_ai" BOOLEAN NOT NULL DEFAULT false;

-- Add index
CREATE INDEX "documents_extraction_status_idx" ON "documents"("extraction_status");
```

**Pros**:

- Proper migration history maintained
- Can be deployed to production safely
- Future-proof solution

**Cons**:

- Need to handle case where `legal_platform` has no `_prisma_migrations` table

**Risk**: Low

### Option B: Use `db push` Directly

**Approach**: Run `prisma db push` against `legal_platform` database to sync schema

**Files to change**: None (just run command)

**Pros**:

- Quick fix
- Works immediately

**Cons**:

- No migration history
- May cause issues in production deployment
- Doesn't fix root cause (no migration file)

**Risk**: Medium

### Option C: Reset `legal_platform` and Run Migrations

**Approach**: Drop and recreate `legal_platform` database, apply all migrations

**Pros**:

- Clean database state
- Full migration history

**Cons**:

- Loses all existing data in `legal_platform`
- May not be viable if data is needed

**Risk**: High (data loss)

### Recommendation

**Option A** is recommended. Create a proper migration that:

1. Handles the enum creation idempotently
2. Adds the columns with proper defaults
3. Can be safely applied to both `legal_platform` and production databases

If `legal_platform` lacks `_prisma_migrations`, first run:

```bash
prisma migrate resolve --applied <all-existing-migrations>
```

to mark existing migrations as applied before adding new ones.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces (document creation works)
2. [ ] Existing documents can still be viewed/edited
3. [ ] Document upload flow still works
4. [ ] Content extraction can be triggered (if implemented)
5. [ ] Migration can be applied cleanly to fresh database

### Suggested Test Cases

```typescript
// document.resolvers.test.ts
describe('createBlankDocument', () => {
  it('should create a document with default extraction status', async () => {
    // Create document via GraphQL mutation
    // Verify document.extractionStatus === 'NONE'
  });

  it('should handle document creation without explicit extraction fields', async () => {
    // Create document
    // Verify no errors thrown
    // Verify defaults are applied
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                                | Purpose            | Relevant Finding                                                       |
| ------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                            | Database schema    | Has uncommitted changes adding extraction fields                       |
| `services/gateway/src/graphql/resolvers/document.resolvers.ts:3725` | Document creation  | Creates document without explicit extractionStatus (relies on default) |
| `services/gateway/src/workers/content-extraction.worker.ts`         | Background worker  | Uses `DocumentExtractionStatus` enum                                   |
| `.env.local`                                                        | Environment config | Points to `legal_platform` database                                    |

### Database Investigation

```sql
-- legal_platform (active) has 31 columns, missing extraction fields
-- legal_platform_seed has 36 columns, has extraction fields
```

### Git Status

Schema changes are uncommitted:

```
modified:   packages/database/prisma/schema.prisma
```

No migration file exists for the extraction fields.

### Questions Answered During Investigation

- Q: Why does the column exist in one place but not another?
- A: `legal_platform_seed` had migrations applied or `db push` run; `legal_platform` did not

- Q: Is the Prisma client regenerated?
- A: Yes, it was regenerated during investigation, but that wasn't the issue

- Q: Why did VS Code crash?
- A: Likely unrelated - could be resource pressure from TypeScript compilation

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug extraction-status-missing
```

The debug phase will:

1. Read this investigation document
2. Create proper migration for extraction fields
3. Handle the `_prisma_migrations` table issue
4. Apply migration to `legal_platform` database
5. Verify the fix
