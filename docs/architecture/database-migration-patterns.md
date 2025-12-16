# Database Migration Patterns

**Version:** 1.0
**Last Updated:** 2025-11-20
**Status:** Active

## Overview

This document defines migration patterns for safely evolving database schemas with minimal or zero downtime. It provides decision frameworks, detailed patterns, and concrete examples for common migration scenarios.

---

## Table of Contents

1. [Migration Decision Matrix](#migration-decision-matrix)
2. [Zero-Downtime Patterns](#zero-downtime-patterns)
3. [Expand-Contract Pattern (Detailed)](#expand-contract-pattern-detailed)
4. [Common Migration Scenarios](#common-migration-scenarios)
5. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
6. [Feature Flags for Schema Changes](#feature-flags-for-schema-changes)

---

## Migration Decision Matrix

Use this matrix to determine the appropriate migration strategy based on change type.

| Change Type                   | Backward Compatible? | Downtime Required? | Strategy                                | Risk Level  |
| ----------------------------- | -------------------- | ------------------ | --------------------------------------- | ----------- |
| **Add table**                 | ✅ Yes               | ❌ No              | Direct migration                        | 🟢 Low      |
| **Add column (nullable)**     | ✅ Yes               | ❌ No              | Direct migration                        | 🟢 Low      |
| **Add column (with default)** | ✅ Yes               | ⚠️ Maybe           | Add nullable → backfill → make required | 🟡 Medium   |
| **Add column (required)**     | ❌ No                | ❌ No              | Add nullable → backfill → make required | 🟡 Medium   |
| **Rename column**             | ❌ No                | ❌ No              | Expand-contract pattern                 | 🟠 High     |
| **Remove column**             | ❌ No                | ❌ No              | Deprecate → stop using → remove         | 🟠 High     |
| **Change column type**        | ❌ No                | ❌ No              | Add new → migrate → remove old          | 🟠 High     |
| **Add index**                 | ✅ Yes               | ❌ No              | CREATE INDEX CONCURRENTLY               | 🟢 Low      |
| **Add foreign key**           | ⚠️ Maybe             | ⚠️ Maybe           | Add as NOT VALID → validate separately  | 🟡 Medium   |
| **Remove table**              | ❌ No                | ❌ No              | Deprecate → stop using → remove         | 🔴 Critical |
| **Large data backfill**       | Depends              | ❌ No              | Batch processing with throttling        | 🟡 Medium   |
| **Split table**               | ❌ No                | ❌ No              | Dual-write → backfill → switch reads    | 🔴 Critical |
| **Merge tables**              | ❌ No                | ❌ No              | Dual-write → backfill → switch reads    | 🔴 Critical |

### Risk Level Definitions

- 🟢 **Low:** Safe to execute with standard procedures
- 🟡 **Medium:** Requires careful testing and monitoring
- 🟠 **High:** Requires expand-contract pattern and staged rollout
- 🔴 **Critical:** Requires extensive planning, testing, and possible blue-green deployment

---

## Zero-Downtime Patterns

### Pattern 1: Additive Changes (Safest)

**Principle:** Only add new structures, never modify or remove existing ones.

**Use Cases:**

- Adding new tables
- Adding nullable columns
- Adding new indexes (with CONCURRENTLY)

**Example:**

```sql
-- Migration: Add new table (zero downtime)
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX CONCURRENTLY idx_user_preferences_user_id
ON user_preferences(user_id);
```

**Deployment:**

1. Apply migration
2. Deploy code that uses new table (optional, reads will return empty)
3. Backfill data if needed

**Rollback:** Simply don't use the new table. Drop in future migration if needed.

---

### Pattern 2: Backward-Compatible Defaults

**Principle:** Add columns with sensible defaults that work with existing code.

**Use Cases:**

- Adding columns with default values
- Adding columns with NULL allowed

**Example:**

```sql
-- Migration: Add column with default
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Index for queries
CREATE INDEX CONCURRENTLY idx_users_email_verified
ON users(email_verified);
```

**Deployment:**

1. Apply migration (existing code unaffected)
2. Deploy code that sets `email_verified = true` for new users
3. Backfill existing users later

**Rollback:** Column nullable/default allows old code to continue working.

---

### Pattern 3: CREATE INDEX CONCURRENTLY

**Principle:** Create indexes without locking the table.

**PostgreSQL Specific:** Use `CONCURRENTLY` keyword to allow reads/writes during index creation.

**Example:**

```sql
-- Bad: Locks table (downtime)
CREATE INDEX idx_cases_status ON cases(status);

-- Good: No lock (zero downtime)
CREATE INDEX CONCURRENTLY idx_cases_status ON cases(status);
```

**Important Notes:**

- `CONCURRENTLY` takes longer than regular index creation
- Cannot be run inside a transaction
- If it fails, may leave an invalid index (must be dropped manually)

**Verification:**

```sql
-- Check index is valid
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE indexname = 'idx_cases_status';

-- Check for invalid indexes
SELECT * FROM pg_index WHERE NOT indisvalid;
```

---

### Pattern 4: ADD CONSTRAINT NOT VALID

**Principle:** Add foreign key constraints without immediate validation.

**Use Cases:**

- Adding foreign keys to large existing tables
- Adding CHECK constraints on existing data

**Example:**

```sql
-- Step 1: Add constraint as NOT VALID (fast, doesn't check existing rows)
ALTER TABLE documents
ADD CONSTRAINT fk_documents_case_id
FOREIGN KEY (case_id) REFERENCES cases(id)
NOT VALID;

-- Step 2: Validate constraint in background (can be slow)
ALTER TABLE documents
VALIDATE CONSTRAINT fk_documents_case_id;
```

**Benefits:**

- Step 1 is fast (milliseconds)
- Step 2 can run during low-traffic period
- New rows immediately checked
- Existing rows validated gradually

---

## Expand-Contract Pattern (Detailed)

The expand-contract pattern is the **gold standard** for zero-downtime breaking changes.

### Three Phases

1. **Expand:** Add new structure alongside old
2. **Migrate:** Dual-write to both, backfill data, switch reads
3. **Contract:** Remove old structure

### Example: Renaming a Column

**Scenario:** Rename `users.name` to `users.full_name`

#### Phase 1: Expand (Add new column)

**Migration 001:**

```sql
-- Add new column (nullable initially)
ALTER TABLE users ADD COLUMN full_name VARCHAR(200);

-- Create index on new column
CREATE INDEX CONCURRENTLY idx_users_full_name ON users(full_name);
```

**Prisma Schema Update (v1):**

```prisma
model User {
  id        String   @id @default(uuid())
  name      String?  // Old column (now optional)
  full_name String?  // New column (optional)
  // ... other fields
}
```

**Application Code (Dual-Write):**

```typescript
// Write to BOTH columns
await prisma.user.create({
  data: {
    name: fullName, // Old column
    full_name: fullName, // New column
  },
});

// Read from OLD column (for now)
const userName = user.name;
```

**Deploy:** ✅ Safe - Old code continues working

---

#### Phase 2a: Backfill Data

**Migration 002:**

```sql
-- Backfill existing rows (may take time on large tables)
-- Run during low-traffic period or in batches
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Verify backfill complete
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM users WHERE full_name IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows with null full_name', null_count;
  END IF;
END $$;
```

**For Large Tables:** Use batched updates to avoid locks:

```sql
-- Batch update (1000 rows at a time)
DO $$
DECLARE
  batch_size INTEGER := 1000;
  affected INTEGER := batch_size;
BEGIN
  WHILE affected = batch_size LOOP
    UPDATE users
    SET full_name = name
    WHERE id IN (
      SELECT id FROM users
      WHERE full_name IS NULL
      LIMIT batch_size
    );

    GET DIAGNOSTICS affected = ROW_COUNT;
    COMMIT; -- Release locks between batches
    PERFORM pg_sleep(0.1); -- Throttle to avoid overwhelming DB
  END LOOP;
END $$;
```

---

#### Phase 2b: Switch Reads

**Application Code Update:**

```typescript
// Write to BOTH columns (continue)
await prisma.user.create({
  data: {
    name: fullName, // Old column
    full_name: fullName, // New column
  },
});

// Read from NEW column now
const userName = user.full_name;
```

**Deploy:** ✅ Safe - Both columns have same data

**Monitor:** Watch for any application errors for 24-48 hours

---

#### Phase 3a: Make New Column Required

**Migration 003:**

```sql
-- Now safe to make new column NOT NULL
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

**Prisma Schema Update (v2):**

```prisma
model User {
  id        String   @id @default(uuid())
  name      String?  // Old column (still optional, deprecated)
  full_name String   // New column (now required)
  // ... other fields
}
```

---

#### Phase 3b: Contract (Remove old column)

**Wait 48+ hours with stable production**

**Migration 004:**

```sql
-- Drop old column (breaking change, but code no longer uses it)
ALTER TABLE users DROP COLUMN name;

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_users_name;
```

**Prisma Schema Update (v3 - Final):**

```prisma
model User {
  id        String   @id @default(uuid())
  full_name String   // Single source of truth
  // ... other fields
}
```

**Application Code (Cleanup):**

```typescript
// Only write to new column
await prisma.user.create({
  data: {
    full_name: fullName, // Clean, single column
  },
});

// Read from new column
const userName = user.full_name;
```

---

### Timeline Summary

| Phase                 | Duration  | Risk   | Can Rollback?                   |
| --------------------- | --------- | ------ | ------------------------------- |
| Expand (add column)   | 1 day     | Low    | ✅ Yes - don't use new column   |
| Backfill data         | 1-7 days  | Low    | ✅ Yes - still using old column |
| Switch reads          | 2-7 days  | Medium | ✅ Yes - both columns identical |
| Make required         | 1 day     | Low    | ⚠️ Harder - may break old code  |
| Contract (remove old) | Immediate | High   | ❌ No - data deleted            |

**Total Timeline:** 1-3 weeks for safe, zero-downtime migration

---

## Common Migration Scenarios

### Scenario 1: Add Required Column with No Default

**Problem:** Adding a NOT NULL column without a default breaks existing code.

**Solution:**

```sql
-- Step 1: Add column as nullable with temporary default
ALTER TABLE cases ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';

-- Step 2: Deploy code that sets priority explicitly
-- (Application code updated)

-- Step 3: Backfill any NULL values
UPDATE cases SET priority = 'medium' WHERE priority IS NULL;

-- Step 4: Make column NOT NULL
ALTER TABLE cases ALTER COLUMN priority SET NOT NULL;

-- Step 5: Remove default (if appropriate)
ALTER TABLE cases ALTER COLUMN priority DROP DEFAULT;
```

---

### Scenario 2: Change Column Type

**Problem:** Changing column type can cause data loss or application errors.

**Solution (Expand-Contract):**

```sql
-- Step 1: Add new column with target type
ALTER TABLE documents ADD COLUMN file_size_bytes BIGINT;

-- Step 2: Dual-write (application code)
-- Step 3: Backfill
UPDATE documents SET file_size_bytes = file_size::BIGINT WHERE file_size_bytes IS NULL;

-- Step 4: Switch reads to new column
-- Step 5: Drop old column
ALTER TABLE documents DROP COLUMN file_size;

-- Step 6: Rename new column (optional)
ALTER TABLE documents RENAME COLUMN file_size_bytes TO file_size;
```

---

### Scenario 3: Split a Table

**Problem:** Splitting `users` into `users` and `user_profiles`.

**Solution:**

```sql
-- Step 1: Create new table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  bio TEXT,
  avatar_url VARCHAR(500),
  timezone VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Step 2: Dual-write (application writes to both tables)
-- Step 3: Backfill
INSERT INTO user_profiles (user_id, bio, avatar_url, timezone)
SELECT id, bio, avatar_url, timezone FROM users;

-- Step 4: Switch reads to new table
-- Step 5: Drop columns from old table
ALTER TABLE users
DROP COLUMN bio,
DROP COLUMN avatar_url,
DROP COLUMN timezone;
```

---

### Scenario 4: Merge Two Tables

**Problem:** Merging `temp_users` into `users`.

**Solution:**

```sql
-- Step 1: Ensure target table has all columns
ALTER TABLE users ADD COLUMN is_temporary BOOLEAN DEFAULT false;

-- Step 2: Migrate data
INSERT INTO users (email, first_name, last_name, is_temporary, created_at)
SELECT email, first_name, last_name, true, created_at
FROM temp_users
ON CONFLICT (email) DO NOTHING; -- Handle duplicates

-- Step 3: Verify migration
SELECT COUNT(*) FROM temp_users; -- Note count
SELECT COUNT(*) FROM users WHERE is_temporary = true; -- Should match

-- Step 4: Update application to stop writing to temp_users
-- Step 5: Drop temp table (after monitoring period)
DROP TABLE temp_users;
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Modifying Columns In-Place

**Bad:**

```sql
-- Dangerous: Changes column type directly
ALTER TABLE users ALTER COLUMN age TYPE BIGINT;
```

**Why Bad:**

- May lock table
- Can cause data loss (e.g., VARCHAR to INT)
- Breaks existing code immediately

**Good Alternative:** Use expand-contract (add new column → migrate → remove old)

---

### ❌ Anti-Pattern 2: Dropping Columns Without Deprecation

**Bad:**

```sql
-- Dangerous: Immediately drops column
ALTER TABLE users DROP COLUMN legacy_field;
```

**Why Bad:**

- Breaks code still using the column
- No rollback possible (data deleted)

**Good Alternative:**

1. Stop writing to column (deploy code change)
2. Monitor for 7+ days
3. Then drop column

---

### ❌ Anti-Pattern 3: Large Backfills in Single Transaction

**Bad:**

```sql
-- Dangerous: Updates millions of rows at once
UPDATE users SET email_verified = false WHERE email_verified IS NULL;
```

**Why Bad:**

- Locks table for extended period
- Can cause replication lag
- May timeout

**Good Alternative:** Batch updates (shown in Expand-Contract example)

---

### ❌ Anti-Pattern 4: Creating Indexes Without CONCURRENTLY

**Bad:**

```sql
-- Locks table during index creation
CREATE INDEX idx_cases_created_at ON cases(created_at);
```

**Why Bad:**

- Locks table for reads/writes
- Causes downtime on large tables

**Good Alternative:**

```sql
CREATE INDEX CONCURRENTLY idx_cases_created_at ON cases(created_at);
```

---

## Feature Flags for Schema Changes

Use feature flags to gradually roll out schema changes.

### Example: Gradual Rollout of New Column

**Application Code:**

```typescript
import { getFeatureFlag } from '@legal-platform/shared';

async function getUserName(user: User): Promise<string> {
  const useFullName = await getFeatureFlag('use_full_name_column', {
    defaultValue: false,
    rollout: 'gradual', // 0% → 10% → 50% → 100%
  });

  if (useFullName && user.full_name) {
    return user.full_name;
  }

  return user.name; // Fallback to old column
}
```

**Rollout Strategy:**

| Day | Rollout               | Monitor                  |
| --- | --------------------- | ------------------------ |
| 1   | 0% (feature flag off) | Baseline metrics         |
| 2-3 | 10% (canary users)    | Error rates, performance |
| 4-5 | 50% (half of users)   | Error rates, performance |
| 6-7 | 100% (all users)      | Error rates, performance |

**Rollback:**
If issues detected, set feature flag to 0% immediately.

---

## Migration Checklist

Before executing any migration, verify:

- [ ] Migration tested on local database
- [ ] Migration tested on staging environment
- [ ] Backward compatibility ensured (or expand-contract used)
- [ ] Rollback procedure documented
- [ ] Monitoring in place for key metrics
- [ ] Backup created before migration
- [ ] Team notified and on-call assigned
- [ ] Downtime communicated (if any)

---

## References

- [Database Migration Runbook](../../runbooks/database-migration-runbook.md)
- [Migration Risk Assessment](../../runbooks/migration-risk-assessment.md)
- [PostgreSQL Concurrent Index Creation](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- [Prisma Migrate Best Practices](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

---

**Document Version History:**

| Version | Date       | Author    | Changes                                       |
| ------- | ---------- | --------- | --------------------------------------------- |
| 1.0     | 2025-11-20 | Dev Agent | Initial creation with expand-contract example |
