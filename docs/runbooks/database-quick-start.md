# Database Quick Start Guide

**Version:** 1.0
**Last Updated:** 2025-11-20
**Audience:** Developers

---

## Overview

This guide provides quick instructions for common database tasks during development. For production operations, see the [Operations Runbook](../../infrastructure/OPERATIONS_RUNBOOK.md).

---

## Table of Contents

1. [Setting Up Local Database](#setting-up-local-database)
2. [Running Migrations](#running-migrations)
3. [Seeding Test Data](#seeding-test-data)
4. [Resetting Database](#resetting-database)
5. [Common Workflows](#common-workflows)
6. [Troubleshooting](#troubleshooting)

---

## Setting Up Local Database

### Prerequisites

- PostgreSQL 16+ installed
- Node.js 20+ installed
- Project dependencies installed (`pnpm install`)

### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Verify database is running
docker ps | grep postgres
```

**Expected Output:**

```
CONTAINER ID   IMAGE         PORTS                    STATUS
abc123def456   postgres:16   0.0.0.0:5432->5432/tcp   Up 2 minutes
```

### Option B: Using Local PostgreSQL Installation

```bash
# Start PostgreSQL service (macOS with Homebrew)
brew services start postgresql@16

# Or (Linux)
sudo systemctl start postgresql

# Verify service is running
psql --version
```

---

### Configure Database Connection

Create `.env` file in project root (if not exists):

```bash
# Development database URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_platform_dev"

# Redis URL (for sessions and caching)
REDIS_URL="redis://localhost:6379"
```

**Security Note:** Never commit `.env` to git. It's already in `.gitignore`.

---

### Create Development Database

```bash
# Create database
createdb legal_platform_dev

# Verify database created
psql -l | grep legal_platform_dev
```

---

### Enable Required Extensions

```bash
# Connect to database
psql legal_platform_dev

# Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

# Verify extensions
\dx

# Exit
\q
```

**Expected Output:**

```
                 List of installed extensions
    Name     | Version |   Schema   |         Description
-------------+---------+------------+------------------------------
 pg_trgm     | 1.6     | public     | text similarity measurement
 uuid-ossp   | 1.1     | public     | generate universally unique identifiers
 vector      | 0.5.1   | public     | vector data type and ivfflat access method
```

---

## Running Migrations

### Apply All Pending Migrations

```bash
# From project root
cd packages/database

# Apply migrations (development)
pnpm db:migrate

# Or apply without prompts (CI/CD)
pnpm db:migrate:deploy
```

**What this does:**

1. Compares Prisma schema with database
2. Generates migration SQL (if schema changed)
3. Applies migration to database
4. Regenerates Prisma Client

---

### Check Migration Status

```bash
# View applied and pending migrations
pnpm db:migrate:status
```

**Example Output:**

```
Database schema is up to date!

Applied migrations:
  20250120123045_init
  20250121140022_add_user_authentication
```

---

### View Migration History

```bash
# See detailed migration history from database
pnpm db:migrate:history
```

---

### Create New Migration

When you modify `prisma/schema.prisma`:

```bash
# Create and apply migration with descriptive name
pnpm db:migrate

# Prisma will prompt for migration name
# Example: "add_case_status_index"
```

**Migration Naming Convention:**

- Use lowercase with underscores
- Be descriptive: `add_user_roles` not `update_schema`
- Indicate action: `add_`, `remove_`, `modify_`, `create_`

---

## Seeding Test Data

### Run Seed Script

```bash
# Seed database with test data
pnpm db:seed
```

**Note:** Seed script is currently ready but requires Prisma models to be added in Stories 2.4, 2.6, 2.7, 2.8. See `prisma/seed.ts` for structure.

**What gets seeded:**

- 1 Demo law firm
- 5 Users (1 Partner, 2 Associates, 2 Paralegals)
- 10 Sample cases (various statuses and types)
- 20 Sample documents (various types)
- 30 Sample tasks (including overdue tasks)

**Idempotency:** Running seed multiple times won't create duplicates.

---

### View Seeded Data

```bash
# Open Prisma Studio (GUI for database)
pnpm prisma:studio
```

**Access:** Opens browser at http://localhost:5555

**Features:**

- View all tables
- Edit data inline
- Run queries
- Export data

---

## Resetting Database

### Full Reset (Nuclear Option)

```bash
# WARNING: Deletes ALL data and reapplies migrations
pnpm db:push

# Or manually:
dropdb legal_platform_dev && createdb legal_platform_dev
pnpm db:migrate
pnpm db:seed
```

**When to use:**

- Database in inconsistent state
- Want fresh start
- Migration conflicts

---

### Reset Data Only (Keep Schema)

```bash
# Delete all data but keep tables
psql legal_platform_dev -c "TRUNCATE users, cases, documents, tasks CASCADE;"

# Re-seed
pnpm db:seed
```

---

## Common Workflows

### Workflow 1: Add a New Table

**Scenario:** Adding a `notifications` table

**Steps:**

1. **Update Prisma Schema:**

```prisma
// packages/database/prisma/schema.prisma
model Notification {
  id         String   @id @default(uuid())
  user_id    String
  message    String
  read       Boolean  @default(false)
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([read])
}
```

2. **Create Migration:**

```bash
pnpm db:migrate
# Enter name: "add_notifications_table"
```

3. **Verify Migration:**

```bash
# Check migration was created
ls prisma/migrations/

# Check migration applied
pnpm db:migrate:status
```

4. **Use in Code:**

```typescript
import { prisma } from '@legal-platform/database';

// Create notification
await prisma.notification.create({
  data: {
    user_id: userId,
    message: 'New case assigned to you',
    read: false,
  },
});

// Query notifications
const unread = await prisma.notification.findMany({
  where: { user_id: userId, read: false },
});
```

---

### Workflow 2: Add a Column to Existing Table

**Scenario:** Adding `phone_number` to `users` table

**Steps:**

1. **Update Prisma Schema:**

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  phone_number String?  // Add nullable column
  // ... other fields
}
```

2. **Create Migration:**

```bash
pnpm db:migrate
# Enter name: "add_user_phone_number"
```

3. **Verify in Database:**

```bash
psql legal_platform_dev -c "\d users"
```

**Column appears in schema:**

```
Column      | Type         | Nullable
phone_number| varchar(255) | YES
```

---

### Workflow 3: Rename a Column (Production-Safe)

**Scenario:** Renaming `users.name` to `users.full_name`

**Safe Approach (Expand-Contract Pattern):**

**Phase 1: Add new column**

```bash
# Update schema: add full_name (nullable)
pnpm db:migrate  # Name: "add_user_full_name"
```

**Phase 2: Dual-write**

```typescript
// Application code writes to both
await prisma.user.create({
  data: {
    name: fullName, // Old
    full_name: fullName, // New
  },
});
```

**Phase 3: Backfill**

```sql
UPDATE users SET full_name = name WHERE full_name IS NULL;
```

**Phase 4: Switch reads**

```typescript
// Read from new column
const userName = user.full_name;
```

**Phase 5: Remove old column**

```bash
# Update schema: remove name
pnpm db:migrate  # Name: "remove_user_name"
```

See [Migration Patterns](../architecture/database-migration-patterns.md) for detailed explanation.

---

### Workflow 4: Create an Index

**Scenario:** Improve query performance on `cases.status`

**Best Practice (CONCURRENTLY):**

1. **Update Prisma Schema:**

```prisma
model Case {
  status String

  @@index([status])
}
```

2. **Create Migration:**

```bash
pnpm db:migrate
```

3. **Edit Generated Migration** (for production safety):

```sql
-- Migration file: 20250120_add_case_status_index/migration.sql

-- Replace:
-- CREATE INDEX "cases_status_idx" ON "cases"("status");

-- With:
CREATE INDEX CONCURRENTLY "cases_status_idx" ON "cases"("status");
```

**Why CONCURRENTLY:**

- Doesn't lock table during index creation
- Safe for production
- Takes longer but zero downtime

---

## Troubleshooting

### Issue: "Database does not exist"

**Error:**

```
Error: Can't reach database server at `localhost:5432`
```

**Solution:**

```bash
# Check PostgreSQL is running
pg_isready

# If not running, start it
brew services start postgresql@16  # macOS
sudo systemctl start postgresql     # Linux

# Verify database exists
psql -l | grep legal_platform_dev

# Create if missing
createdb legal_platform_dev
```

---

### Issue: "Extension not found"

**Error:**

```
Error: Type "vector" does not exist
```

**Solution:**

```bash
# Connect and enable extension
psql legal_platform_dev

# Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\q
```

---

### Issue: "Migration conflict"

**Error:**

```
Error: Migration conflict detected
```

**Solution:**

```bash
# Reset migrations (development only!)
rm -rf prisma/migrations
pnpm db:push  # Push schema directly

# Or fix manually:
pnpm db:migrate:status  # See conflict
# Resolve in migration files
pnpm db:migrate:resolve --rolled-back [migration-name]
```

**Production:** Never delete migrations in production. Use rollback procedure.

---

### Issue: "Prisma Client not generated"

**Error:**

```
Error: @prisma/client did not initialize yet
```

**Solution:**

```bash
# Regenerate Prisma Client
cd packages/database
pnpm prisma:generate

# Or rebuild entire package
pnpm build
```

---

### Issue: "Connection pool exhausted"

**Error:**

```
Error: Prepared statement "p1" already exists
```

**Solution:**

```bash
# Restart application
# Or increase pool size in env

# In .env:
DATABASE_POOL_SIZE=20  # Increase from 10

# Restart database connection pool
docker-compose restart postgres
```

---

### Issue: "Permission denied"

**Error:**

```
ERROR: permission denied for schema public
```

**Solution:**

```bash
# Grant permissions
psql legal_platform_dev

GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;

\q
```

---

## Useful Commands Reference

### Database Commands

```bash
# List all databases
psql -l

# Connect to database
psql legal_platform_dev

# Drop database (WARNING: deletes all data)
dropdb legal_platform_dev

# Create database
createdb legal_platform_dev

# Backup database
pg_dump legal_platform_dev > backup.sql

# Restore database
psql legal_platform_dev < backup.sql
```

---

### Prisma Commands

```bash
# Generate Prisma Client
pnpm prisma:generate

# Open Prisma Studio
pnpm prisma:studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate

# Pull schema from database
npx prisma db pull

# Push schema to database (dev only)
npx prisma db push
```

---

### Migration Commands

```bash
# Create and apply migration
pnpm db:migrate

# Apply migrations (no prompts)
pnpm db:migrate:deploy

# Check migration status
pnpm db:migrate:status

# View migration history
pnpm db:migrate:history

# Rollback migration
pnpm db:migrate:undo
```

---

### Data Commands

```bash
# Seed database
pnpm db:seed

# Anonymize data
pnpm db:anonymize

# Validate data integrity
pnpm db:validate

# Backup database
pnpm db:backup

# Restore database
pnpm db:restore
```

---

## SQL Quick Reference

### Common Queries

```sql
-- List all tables
\dt

-- Describe table structure
\d users

-- View table size
SELECT pg_size_pretty(pg_total_relation_size('users'));

-- View row count
SELECT COUNT(*) FROM users;

-- View migration history
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'legal_platform_dev';

-- Kill stuck queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction' AND query_start < NOW() - INTERVAL '10 minutes';
```

---

## Environment Variables Reference

| Variable                   | Description                  | Default  | Example                               |
| -------------------------- | ---------------------------- | -------- | ------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string | Required | `postgresql://user:pass@host:5432/db` |
| `DATABASE_POOL_SIZE`       | Connection pool size         | 10       | 20                                    |
| `DATABASE_MAX_CONNECTIONS` | Max connections              | 20       | 50                                    |
| `REDIS_URL`                | Redis connection string      | Required | `redis://localhost:6379`              |

---

## Next Steps

- **Read:** [Migration Patterns Documentation](../architecture/database-migration-patterns.md)
- **Read:** [Production Migration Runbook](database-migration-runbook.md)
- **Explore:** [Prisma Documentation](https://www.prisma.io/docs)
- **Practice:** Create test migrations on your local database

---

**Document Version History:**

| Version | Date       | Author    | Changes          |
| ------- | ---------- | --------- | ---------------- |
| 1.0     | 2025-11-20 | Dev Agent | Initial creation |
