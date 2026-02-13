# Investigation: Cases Not Showing in Production

**Slug**: cases-not-showing
**Date**: 2026-01-10
**Status**: Investigation Complete
**Severity**: Critical
**Next step**: `/debug cases-not-showing` to implement fix

---

## Bug Summary

**Reported symptom**: Cases don't show up in `/cases` page, but email folders appear in `/email`. When clicking the "in asteptare" filter, an error is displayed.

**Error message**:

```
Eroare la incarcarea cazurilor
Invalid `prisma.case.findMany()` invocation: The column `clients.client_type` does not exist in the current database.
```

**Reproduction steps**:

1. Go to the deployed app at legal-platform-web.onrender.com
2. Log in with Azure AD
3. Navigate to `/cases`
4. Observe error: "Eroare la incarcarea cazurilor"

**Expected behavior**: Cases should display in a list
**Actual behavior**: Error message about missing `client_type` column
**Frequency**: Always (100% reproducible)

---

## Root Cause Analysis

### The Bug

**Root cause**: Schema columns were added to the `clients` table via `prisma db push` in development but no migration file was created. Production uses `prisma migrate deploy` which requires migration files.

**Location**: `packages/database/prisma/schema.prisma:246-251` (schema) - missing migration

**Code path**:

```
/cases page → CASES GraphQL query → case.resolvers.ts:293 → prisma.case.findMany({ include: { client: true } }) → FAILS
```

**Type**: Environment/Deployment bug (missing database migration)

### Why It Happens

In commit `1a8173c` (Jan 9, 2026), six new columns were added to the `Client` model in the Prisma schema:

```prisma
clientType         String?    @default("company") @map("client_type")
companyType        String?    @map("company_type")
cui                String?    @db.VarChar(20)
registrationNumber String?    @map("registration_number")
administrators     Json       @default("[]")
contacts           Json       @default("[]")
```

These were applied to the local development database using `prisma db push`, which directly modifies the database schema without creating migration files.

However, production deployments use `prisma migrate deploy`, which only applies changes that have corresponding migration files. Since no migration was created for these columns, production's database is missing them.

When the `cases` query runs, it includes `client: true` which causes Prisma to select all columns from the `clients` table. The generated Prisma client expects `client_type` to exist (because the schema says it does), but the production database doesn't have it.

### Why It Wasn't Caught

1. **Local development worked**: `db push` applied the schema changes locally
2. **No migration discipline**: The schema was updated without creating a corresponding migration
3. **No staging environment**: Changes went directly to production
4. **No schema validation in CI**: No check that schema changes have migrations

---

## Impact Assessment

**Affected functionality**:

- `/cases` page - completely broken
- Any GraphQL query that includes `client: true`
- Creating new cases (uses client fields)
- Case detail pages
- Potentially: bulk communication, AI features that load cases with clients

**Blast radius**: Wide - core functionality is broken

**Related code that includes `client: true`**:

- `services/gateway/src/graphql/resolvers/case.resolvers.ts:296` - cases query
- `services/gateway/src/graphql/resolvers/case.resolvers.ts:315` - case query
- `services/gateway/src/services/bulk-communication.service.ts:707`
- `services/gateway/src/services/embedding.service.ts` - embedding generation
- Multiple other services and resolvers

**Risk of similar bugs**: High - any schema change done with `db push` without migration

---

## Proposed Fix Approaches

### Option A: Create Migration for Missing Columns (Recommended)

**Approach**: Create a new migration file that adds the 6 missing columns to the `clients` table

**Files to create**:

- `packages/database/prisma/migrations/20260110100000_add_client_company_fields/migration.sql`

**Migration SQL**:

```sql
-- Add client company detail columns
ALTER TABLE "clients" ADD COLUMN "client_type" VARCHAR(20) DEFAULT 'company';
ALTER TABLE "clients" ADD COLUMN "company_type" VARCHAR(20);
ALTER TABLE "clients" ADD COLUMN "cui" VARCHAR(20);
ALTER TABLE "clients" ADD COLUMN "registration_number" VARCHAR(50);
ALTER TABLE "clients" ADD COLUMN "administrators" JSONB DEFAULT '[]';
ALTER TABLE "clients" ADD COLUMN "contacts" JSONB DEFAULT '[]';
```

**Pros**:

- Standard Prisma migration approach
- Safe, additive change (all columns are nullable or have defaults)
- Production will be in sync with schema

**Cons**:

- Requires deployment to apply

**Risk**: Low - all columns are optional with safe defaults

### Option B: Direct SQL Fix (Emergency)

**Approach**: Run the ALTER TABLE commands directly on production database

**Pros**:

- Immediate fix without redeployment

**Cons**:

- Migration history will be out of sync
- Not recommended for long-term maintenance
- Still need to create migration file for consistency

**Risk**: Medium - bypasses migration system

### Recommendation

**Option A** - Create a proper migration file. This is the correct approach that keeps the database migration history in sync. Since all new columns are nullable or have defaults, the migration is safe to run.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Original bug no longer reproduces - `/cases` loads successfully
2. [ ] Individual case pages load correctly
3. [ ] Creating a new case works
4. [ ] Existing cases display correctly (no data loss)
5. [ ] "In asteptare" filter works
6. [ ] Email functionality still works
7. [ ] Client portfolio view works if implemented

### Manual Test Steps

1. Deploy migration to production
2. Navigate to `/cases` - should show list of cases
3. Click on a case - should show case details with client info
4. Click "In asteptare" filter - should filter cases correctly
5. Try creating a new case - should work

---

## Investigation Notes

### Files Examined

| File                                                       | Purpose              | Relevant Finding                                     |
| ---------------------------------------------------------- | -------------------- | ---------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                   | DB schema            | Has `client_type` etc. on line 246-251               |
| `packages/database/prisma/migrations/`                     | Migration files      | No migration for client company fields               |
| `services/gateway/src/graphql/resolvers/case.resolvers.ts` | Cases resolver       | Line 296: `include: { client: true }` causes failure |
| Git commit `1a8173c`                                       | Added schema changes | No migration created with the schema change          |

### Git History

- **Commit 1a8173c** (Jan 9, 2026 19:08): "feat: word add-in improvements, document management, and cleanup"
  - Added 6 columns to Client model in schema
  - No migration file created

- **Last migrations** (Jan 8, 2026):
  - `20260108100000_add_personal_threads`
  - `20260108120000_add_onrc_template_columns`

### Questions Answered During Investigation

- Q: Why do emails work but cases don't?
- A: Email queries don't include `client: true`, so they don't try to read the missing columns

- Q: When did this break?
- A: After deployment of commit `1a8173c` on Jan 9, 2026

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug cases-not-showing
```

The debug phase will:

1. Read this investigation document
2. Create the migration file with the 6 missing columns
3. Test locally
4. Deploy to production
