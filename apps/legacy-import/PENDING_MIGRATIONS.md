# Pending Database Migrations

This file tracks migrations that need to be applied to production.

## How to Apply

**Option 1: Direct SQL**

```bash
# Connect via SSH tunnel first, then:
psql $DATABASE_URL -f prisma/migrations/<migration_folder>/migration.sql
```

**Option 2: Prisma Migrate**

```bash
cd apps/legacy-import && pnpm exec prisma migrate deploy
```

---

## Pending Migrations

_(No pending migrations)_

---

## Applied Migrations

### 1. `20260205_validation_tracking` - Validation Attribution Tracking

**Applied:** 2026-02-05
**Applied by:** Claude Code

**Description:** Adds fields to track who validated clusters and classified documents.

**Changes:**

- `document_clusters.validated_by` (TEXT) - User ID who approved/rejected
- `document_clusters.validated_at` (TIMESTAMPTZ) - When validated
- `extracted_documents.cluster_validated_by` (TEXT) - User ID who validated doc in cluster

**File:** `prisma/migrations/20260205_validation_tracking/migration.sql`

---

### 2. `20260205_validation_flow` - Validation Flow for Document Review

**Applied:** 2026-02-05
**Applied by:** Claude Code

**Description:** Adds fields for the new validation workflow supporting Accept/Delete/Reclassify actions on documents and soft-delete on clusters.

**Changes:**

- New `ValidationStatus` enum: Pending, Accepted, Deleted, Reclassified
- `extracted_documents.validation_status` (ValidationStatus) - New validation status
- `extracted_documents.validated_by` (TEXT) - User ID who validated
- `extracted_documents.validated_at` (TIMESTAMPTZ) - When validated
- `extracted_documents.reclassification_note` (TEXT) - Free-text annotation for reclassified docs
- `extracted_documents.reclassification_round` (INTEGER) - Increments each re-clustering cycle
- `document_clusters.is_deleted` (BOOLEAN) - Soft delete flag
- `document_clusters.deleted_by` (TEXT) - User ID who deleted
- `document_clusters.deleted_at` (TIMESTAMPTZ) - When deleted
- `ReClustering` added to CategorizationPipelineStatus enum

**File:** `prisma/migrations/20260205_validation_flow/migration.sql`
