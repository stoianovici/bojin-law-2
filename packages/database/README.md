# Database Package

This package contains database schemas, migrations, and utilities for the Legal Platform.

## Directory Structure

```
packages/database/
├── migrations/           # SQL migration files
│   └── 001_add_skills_tables.sql
├── scripts/             # Database utility scripts
│   └── run-migration.sh
└── README.md
```

## Migrations

This project uses **Prisma Migrate** for schema versioning and database migrations. Prisma automatically generates migration files from changes to `schema.prisma`.

### Prisma Migration Workflow

#### Creating a New Migration

When you modify `prisma/schema.prisma`, create a migration:

```bash
# Development: Create and apply migration
pnpm db:migrate

# Or with custom name
npx prisma migrate dev --name add_user_table --schema=./prisma/schema.prisma
```

This will:

1. Generate migration SQL in `prisma/migrations/{timestamp}_{name}/migration.sql`
2. Apply migration to development database
3. Regenerate Prisma Client with new schema

#### Deploying Migrations (Production)

```bash
# Apply pending migrations without prompts (CI/CD safe)
pnpm db:migrate:deploy
```

Use this in production deployments - it applies migrations without creating new ones.

#### Checking Migration Status

```bash
# View migration history and pending migrations
pnpm db:migrate:status
```

Output shows:

- Applied migrations (timestamp, name, checksum)
- Pending migrations not yet applied
- Migration history from `_prisma_migrations` table

#### Rolling Back Migrations

Prisma doesn't support automatic rollback (by design for data safety). To rollback:

```bash
# Use custom rollback script
pnpm db:migrate:undo
```

This script:

1. Prompts for confirmation
2. Shows current migration state
3. Requires manual DOWN migration SQL
4. Marks migration as rolled back in `_prisma_migrations`

#### Viewing Migration History

```bash
# Display full migration history
pnpm db:migrate:history
```

Shows:

- Migration name
- Applied timestamp
- Checksum
- Status (applied/rolled back)

### Manual SQL Migrations

For infrastructure changes not managed by Prisma schema (extensions, custom functions):

```bash
# From project root
./packages/database/scripts/run-migration.sh

# Or run a specific migration
psql $DATABASE_URL -f packages/database/migrations/001_add_skills_tables.sql
```

### Migration Naming Convention

**Prisma migrations:** Auto-generated as `{timestamp}_{name}/migration.sql`

Example: `20250120123045_add_user_table/migration.sql`

**Manual SQL migrations:** `{number}_{description}.sql`

Example: `000_enable_extensions.sql`

### Current Migrations

| Migration                    | Description                                       | Date       |
| ---------------------------- | ------------------------------------------------- | ---------- |
| 000_enable_extensions.sql    | Enable pgvector, uuid-ossp, pg_trgm extensions    | 2025-11-20 |
| 001_add_skills_tables.sql    | Add Claude Skills infrastructure tables           | 2025-11-19 |
| 002_add_discovery_tables.sql | Add Document Type Discovery infrastructure tables | 2025-11-19 |

### Migration Best Practices

1. **Always test migrations locally first** before applying to staging/production
2. **Create manual backup** before production migrations: `pnpm db:backup`
3. **Use descriptive names**: `add_user_authentication` not `update_schema`
4. **Review generated SQL** in migration file before applying
5. **Never edit applied migrations** - create new migration instead
6. **Keep migrations small** - one logical change per migration
7. **Document complex migrations** with comments in SQL file

### Migration History Tracking

Prisma automatically tracks migrations in the `_prisma_migrations` table:

```sql
SELECT migration_name, finished_at, applied_steps_count
FROM _prisma_migrations
ORDER BY finished_at DESC;
```

Fields tracked:

- `migration_name`: Unique migration identifier
- `checksum`: SHA256 hash to detect tampering
- `started_at`: Migration start timestamp
- `finished_at`: Migration completion timestamp
- `applied_steps_count`: Number of SQL statements executed
- `rolled_back_at`: Rollback timestamp (if applicable)

### Extensions

The following PostgreSQL extensions are required and must be enabled before running any migrations:

#### pgvector (vector)

Provides vector data type and similarity search operations for AI embeddings.

- **Version:** 0.5+
- **Purpose:** Semantic search for legal documents using AI embeddings
- **Vector Dimension:** 1536 (OpenAI text-embedding-3-small, Claude embeddings)
- **Operations:** Cosine similarity, L2 distance, inner product

#### uuid-ossp

Generates universally unique identifiers (UUIDs) for primary keys.

- **Purpose:** UUID primary keys across all tables
- **Function:** `uuid_generate_v4()`

#### pg_trgm

Provides trigram-based text search for fuzzy matching and full-text search.

- **Purpose:** Fast text search on case names, document titles, party names
- **Indexes:** GIN and GIST indexes for pattern matching
- **Operators:** `LIKE`, `ILIKE`, similarity search

### Enabling Extensions

Extensions must be enabled FIRST before running any table migrations:

```bash
# Run the extensions migration (must be run as superuser or database owner)
psql $DATABASE_URL -f packages/database/migrations/000_enable_extensions.sql

# Verify extensions are installed
psql $DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm');"
```

**Expected Output:**

```
  extname   | extversion
------------+------------
 uuid-ossp  | 1.1
 vector     | 0.5.1
 pg_trgm    | 1.6
```

**Note for Render Deployment:**

Extensions can be enabled via Render Shell after database is provisioned:

1. Go to Render Dashboard → Databases → legal-platform-db
2. Click "Shell" tab
3. Run the extension migration SQL commands
4. Verify installation before deploying backend services

## Seed Data

The seed data script populates the database with test data for development and testing purposes.

### Running Seed Data Script

```bash
# Seed the database with test data
pnpm db:seed

# Or using npm
npm run db:seed
```

### Seed Data Structure

The seed script creates the following test data:

**Law Firm:**

- 1 demo law firm with complete profile (name, address, VAT ID, contact info)

**Users (5 total):**

- 1 Partner
- 2 Associates
- 2 Paralegals

**Cases (10 total):**

- 4 Active
- 2 OnHold
- 2 Closed
- 2 Archived
- Mixed case types covering all enum values

**Documents (20 total):**

- Various document types (Contract, Motion, Brief, etc.)
- Different statuses (Draft, Review, Approved, Filed)
- 50% marked as AI-generated
- Mock storage URLs

**Tasks (30 total):**

- All task types (Research, DocumentCreation, ClientCommunication, etc.)
- Assigned to different users
- Various due dates (past, current, future)
- Different statuses (Pending, InProgress, Completed)

### Idempotency

The seed script is **idempotent** - it can be run multiple times without creating duplicates:

```bash
# First run - creates all data
pnpm db:seed

# Second run - no duplicates created
pnpm db:seed
```

The script checks for existing data (by email for users, case_number for cases) before creating new records.

### Example: Seeding After Reset

```bash
# Reset database to clean state
npx prisma migrate reset --schema=./prisma/schema.prisma

# Seed with test data
pnpm db:seed

# Verify data created
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Customizing Seed Data

Modify `prisma/seed.ts` to customize the seed data structure. See `prisma/seed-data-schema.md` for detailed documentation on seed data schema.

## Backup and Restore

Database backup and restore procedures ensure data safety and disaster recovery capability.

### Automated Backups (Render)

Render automatically backs up the database daily:

- **Schedule:** Daily at 2:00 AM UTC
- **Retention:** 7 days (Standard tier), 14 days (Pro tier)
- **Location:** Render-managed storage
- **Access:** Via Render Dashboard → Databases → Backups tab

**Verify Backup Status:**

1. Go to Render Dashboard → Databases → legal-platform-db
2. Click "Backups" tab
3. Verify latest backup timestamp and size

### Manual Backups

Create manual backups before major changes:

```bash
# Create manual backup
pnpm db:backup

# Or directly with Render CLI
render db backup --database legal-platform-db

# Or with pg_dump
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Create compressed backup (recommended)
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

**When to Create Manual Backups:**

- Before production migrations (always)
- Before major schema changes (always)
- Before data anonymization (recommended)
- Before database maintenance operations (recommended)

### Restoring from Backup

**Restore from Render Backup:**

```bash
# List available backups
render db backups --database legal-platform-db

# Restore specific backup
render db restore --database legal-platform-db --backup [backup-id]

# Or use the restore script
pnpm db:restore
```

**Restore from pg_dump Backup:**

```bash
# Drop existing database (WARNING: destructive)
dropdb legal_platform_dev

# Create fresh database
createdb legal_platform_dev

# Restore from backup
psql $DATABASE_URL < backup-20250120-143000.sql

# Or from compressed backup
gunzip -c backup-20250120-143000.sql.gz | psql $DATABASE_URL
```

### Restore Safety Checklist

Before restoring:

- [ ] **CRITICAL:** Verify you are restoring to correct environment (staging vs production)
- [ ] Backup current database before restore (backup-before-restore)
- [ ] Stop all application services before restore
- [ ] Verify backup file integrity
- [ ] Estimate restore time (communicate downtime)
- [ ] Test database connectivity after restore
- [ ] Run schema validation: `pnpm db:migrate:status`
- [ ] Run data integrity checks: `pnpm db:validate`
- [ ] Restart application services after restore
- [ ] Monitor application logs for errors

### Backup Storage Recommendations

- **Local Development:** Store in `backups/` directory (gitignored)
- **CI/CD Backups:** Upload to Cloudflare R2 or S3 bucket
- **Retention Policy:** Keep 30 days of manual backups
- **Encryption:** Encrypt backups at rest (AES-256)
- **Access Control:** Limit backup access to DevOps team only

## Data Anonymization

Anonymize production data before importing to development/staging environments to protect user privacy and comply with data protection regulations.

### Running Anonymization Script

```bash
# Anonymize current database
pnpm db:anonymize

# Or using ts-node directly
ts-node scripts/anonymize-data.ts
```

### What Gets Anonymized

The anonymization script replaces personally identifiable information (PII) while preserving data structure and relationships:

| Entity    | Fields Anonymized           | Anonymization Strategy |
| --------- | --------------------------- | ---------------------- |
| Users     | first_name, last_name       | "Demo User {N}"        |
| Users     | email                       | "demo{N}@example.com"  |
| Users     | azure_ad_id                 | Random UUID            |
| Clients   | name, address, contact_info | "Demo Client {N}"      |
| Cases     | title, description          | Generic descriptions   |
| Documents | title, content              | Lorem ipsum            |

### What Gets Preserved

- Database structure (tables, columns, indexes, foreign keys)
- Relationships (UUIDs maintained, foreign keys valid)
- Statistical distributions (case types, statuses, dates)
- Data volumes (same number of records)
- Enums and categorical data (unchanged)

### Production Data Export Workflow

To safely import production data to development:

```bash
# 1. Export production database
render db backup --database legal-platform-db
# Or: pg_dump $DATABASE_URL > export-production-$(date +%Y%m%d).sql

# 2. Download export to local machine (secure transfer)

# 3. Import to development database
psql $DATABASE_URL_DEV < export-production-20250120.sql

# 4. Run anonymization script
pnpm db:anonymize

# 5. Verify anonymization completed successfully
pnpm db:validate

# 6. Delete original export file (security)
rm export-production-20250120.sql
```

### Automated Import with Anonymization

Use the combined import script for one-step workflow:

```bash
# Import production export and anonymize automatically
pnpm db:import:anonymized
```

This script:

1. Prompts for backup file path
2. Imports to development database
3. Runs anonymization automatically
4. Verifies anonymization completed
5. Runs data validation checks

### Safety Features

The anonymization script includes safety checks:

- **Production Protection:** Rejects production database URLs (checks for "render.com" or "production")
- **Confirmation Prompt:** Requires explicit confirmation before proceeding
- **Transaction Wrapper:** Entire anonymization runs in transaction (rollback on error)
- **Verification:** Post-anonymization check that no real PII remains

### Configuration

Customize which fields to anonymize by modifying the configuration in `scripts/anonymize-data.ts`:

```typescript
const anonymizationConfig = {
  users: ['first_name', 'last_name', 'email', 'azure_ad_id'],
  clients: ['name', 'address', 'phone', 'email'],
  cases: ['title', 'description'],
  documents: ['title', 'content'],
};
```

## Troubleshooting

Common issues and solutions when working with the database package.

### Migration Issues

**Error: "Migration failed with exit code 1"**

- **Cause:** SQL syntax error or constraint violation
- **Solution:**
  1. Check migration SQL file for syntax errors
  2. Verify foreign key relationships exist
  3. Check if table/column already exists
  4. Review Prisma schema for conflicts

**Error: "Shadow database cannot be created"**

- **Cause:** Prisma needs temporary database for migrations in dev mode
- **Solution:**
  1. Ensure database user has CREATE DATABASE permission
  2. Or use `--skip-shadow-database` flag (not recommended)
  3. On Render: Shadow database created automatically

**Error: "Migration is already applied"**

- **Cause:** Migration already exists in database
- **Solution:**
  1. Check migration status: `pnpm db:migrate:status`
  2. If duplicate, delete local migration file
  3. If missing in database, mark as applied: `npx prisma migrate resolve --applied {migration-name}`

### Connection Issues

**Error: "Can't reach database server"**

- **Cause:** Database not running or connection string incorrect
- **Solution:**
  1. Verify DATABASE_URL environment variable
  2. Check database is running: `psql $DATABASE_URL -c "SELECT 1"`
  3. Verify network access (firewall, VPN)
  4. Check Render database status in dashboard

**Error: "Too many connections"**

- **Cause:** Connection pool exhausted
- **Solution:**
  1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
  2. Reduce pool size in configuration
  3. Close idle connections
  4. Consider upgrading database tier

### Seed Data Issues

**Error: "Unique constraint violation"**

- **Cause:** Seed data already exists
- **Solution:** Seed script is idempotent - check if data already exists before creating

**Error: "Foreign key constraint violation"**

- **Cause:** Creating child records before parents
- **Solution:** Ensure seed script creates entities in correct order (firms → users → cases → documents/tasks)

### Backup/Restore Issues

**Error: "pg_dump: error: connection to database failed"**

- **Cause:** Invalid DATABASE_URL or database not accessible
- **Solution:**
  1. Verify DATABASE_URL is set correctly
  2. Test connection: `psql $DATABASE_URL -c "SELECT 1"`
  3. Check database credentials

**Error: "pg_restore: error: could not execute query"**

- **Cause:** Backup incompatible with target database version
- **Solution:**
  1. Check PostgreSQL version compatibility
  2. Use plain SQL format instead of custom format
  3. Create fresh database before restore

### Permission Issues

**Error: "must be owner of extension"**

- **Cause:** Non-superuser trying to create extensions
- **Solution:**
  1. Connect as database owner or superuser
  2. On Render: Extensions enabled via dashboard (automatic)
  3. Contact platform support if needed

## FAQ

### General Questions

**Q: Do I need to run migrations manually?**

A: No. Prisma migrations are applied automatically:

- Development: `pnpm db:migrate` creates and applies migrations
- Production: `pnpm db:migrate:deploy` applies pending migrations during deployment

**Q: Can I edit an applied migration?**

A: No. Prisma migrations are immutable after being applied. To change schema:

1. Create a new migration with the desired changes
2. Never edit migration files in `prisma/migrations/` after they're applied

**Q: How do I reset my local database?**

```bash
# WARNING: Destroys all data
npx prisma migrate reset --schema=./prisma/schema.prisma

# Then seed with test data
pnpm db:seed
```

### Migration Questions

**Q: What's the difference between `db:migrate` and `db:migrate:deploy`?**

- `db:migrate`: Interactive dev command - creates new migrations from schema changes
- `db:migrate:deploy`: Production command - only applies existing migrations (non-interactive, CI/CD safe)

**Q: How do I rollback a migration?**

```bash
# Use custom rollback script
pnpm db:migrate:undo

# Follow prompts to rollback specific migration
```

Note: Prisma doesn't support automatic rollback. You must write DOWN migration SQL manually.

**Q: How can I see what migrations are pending?**

```bash
pnpm db:migrate:status
```

**Q: Can I run migrations on production safely?**

Yes, but follow these best practices:

1. Test migration on staging first
2. Create manual backup: `pnpm db:backup`
3. Schedule maintenance window (if downtime needed)
4. Use zero-downtime patterns for breaking changes (see `docs/architecture/database-migration-patterns.md`)
5. Monitor application logs after migration

### Seed Data Questions

**Q: Can I run seed script multiple times?**

Yes, the seed script is idempotent and won't create duplicates.

**Q: How do I clear seed data?**

```bash
# Reset database (removes all data including seed data)
npx prisma migrate reset --schema=./prisma/schema.prisma
```

**Q: Can I customize seed data?**

Yes, edit `prisma/seed.ts` to modify seed data structure. See `prisma/seed-data-schema.md` for schema documentation.

**Q: Why are some seed script tests skipped?**

The seed script depends on Prisma models (User, Case, Document, Task) which will be added in Stories 2.4, 2.6, 2.7, 2.8. Tests are commented out until models exist.

### Backup Questions

**Q: How often are automated backups created?**

- Render: Daily at 2:00 AM UTC
- Retention: 7 days (Standard tier), 14 days (Pro tier)

**Q: Can I restore a backup without downtime?**

No, database restores require stopping application services to prevent write conflicts. Use blue-green deployment for zero-downtime restore.

**Q: Where are backups stored?**

- Automated backups: Render-managed storage (encrypted, geographically redundant)
- Manual backups: Local filesystem or cloud storage (S3, Cloudflare R2)

**Q: How long does restore take?**

- Typical: 5-15 minutes for 25GB database
- Varies by database size and network speed

### Anonymization Questions

**Q: Is anonymization reversible?**

No, anonymization is destructive and cannot be reversed. Always keep original production backup separate.

**Q: Does anonymization work on production database?**

No, the script explicitly rejects production database URLs for safety. Only anonymize copies of production data in dev/staging.

**Q: What if I need to preserve some production data?**

Modify the anonymization configuration in `scripts/anonymize-data.ts` to exclude specific fields or tables.

**Q: How do I verify anonymization worked?**

```bash
# Run validation script
pnpm db:validate

# Or manually check for PII
psql $DATABASE_URL -c "SELECT email, first_name FROM users LIMIT 10;"
```

All emails should be `demo{N}@example.com` format and names should be `Demo User {N}`.

### Performance Questions

**Q: Why are migrations slow?**

Possible causes:

- Large tables (index creation locks table)
- Foreign key validation on large datasets
- No concurrent index creation

Solutions:

- Use `CREATE INDEX CONCURRENTLY` for large tables
- Add foreign keys as `NOT VALID` then validate separately
- Batch large data migrations

**Q: How can I monitor database performance?**

```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Check table sizes
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

**Q: Should I use connection pooling?**

Yes, connection pooling is enabled by default. See "Connection Pooling" section above for configuration.

## Tables

### `skills`

Stores Claude Skills metadata, configuration, and effectiveness metrics.

**Key Columns:**

- `skill_id`: Unique identifier for the skill
- `display_name`: Human-readable skill name
- `effectiveness_score`: Calculated score (0-100) based on success rate
- `token_savings_avg`: Average tokens saved per execution
- `usage_count`: Total number of times skill has been used

### `skill_versions`

Tracks version history of skills for rollback and comparison.

**Key Columns:**

- `skill_id`: Reference to parent skill
- `version`: Semantic version number
- `is_current`: Boolean flag for active version
- `content`: Skill definition/configuration

### `skill_usage_logs`

Logs individual skill executions for analytics and cost tracking.

**Key Columns:**

- `skill_id`: Reference to executed skill
- `execution_time_ms`: Duration in milliseconds
- `tokens_used`: Total tokens consumed
- `tokens_saved`: Estimated savings vs traditional approach
- `cost_usd`: Execution cost in USD
- `success`: Execution success/failure flag

## Indexes

All tables include optimized indexes for common query patterns:

- Single-column indexes on frequently filtered fields
- Composite indexes for join operations and range queries
- Descending indexes for time-series data

## Triggers

### `update_skills_updated_at`

Automatically updates the `updated_at` timestamp on skills table modifications.

### `update_skill_stats_on_usage`

Automatically recalculates skill statistics (effectiveness_score, token_savings_avg, usage_count) when new usage logs are inserted.

## Development

### Testing Migrations Locally

```bash
# Start local PostgreSQL
docker-compose up -d postgres

# Run migrations
psql postgresql://postgres:password@localhost:5432/legal_platform_dev \
  -f packages/database/migrations/001_add_skills_tables.sql

# Verify tables created
psql postgresql://postgres:password@localhost:5432/legal_platform_dev \
  -c "\dt skills*"
```

### Rolling Back Migrations

To rollback the skills tables migration:

```sql
DROP TRIGGER IF EXISTS update_skill_stats_on_usage ON skill_usage_logs;
DROP TRIGGER IF EXISTS update_skills_updated_at ON skills;
DROP FUNCTION IF EXISTS update_skill_statistics();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS skill_usage_logs;
DROP TABLE IF EXISTS skill_versions;
DROP TABLE IF EXISTS skills;
```

## Environment Variables

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string

Example:

```
DATABASE_URL=postgresql://user:password@host:port/database
```

## Connection Pooling

The database client is configured with optimized connection pooling for production deployment on Render.com.

### Configuration Parameters

All parameters are configurable via environment variables:

| Variable                      | Description                       | Default | Example |
| ----------------------------- | --------------------------------- | ------- | ------- |
| `DATABASE_MAX_CONNECTIONS`    | Max database connections          | 20      | 20      |
| `DATABASE_POOL_SIZE`          | Pool size per service instance    | 10      | 10      |
| `DATABASE_CONNECTION_TIMEOUT` | Connection timeout (milliseconds) | 30000   | 30000   |
| `DATABASE_STATEMENT_TIMEOUT`  | Query timeout (milliseconds)      | 60000   | 60000   |
| `DATABASE_IDLE_TIMEOUT`       | Idle connection timeout (ms)      | 10000   | 10000   |
| `DATABASE_SSL_MODE`           | SSL mode for connections          | require | require |

### Pool Size Calculation

**Render PostgreSQL Standard Tier:**

- Max connections: 20 (platform limit)
- Services: 2 instances (web + gateway)
- Pool size per service: 10
- Total: 2 × 10 = 20 connections (within limit)

**Scaling Considerations:**

If you add more service instances:

- 3 instances: Pool size = 6 per instance (3 × 6 = 18)
- 4 instances: Pool size = 5 per instance (4 × 5 = 20)
- 5+ instances: Upgrade to Render PostgreSQL Pro tier (100 connections)

### Usage

```typescript
import { prisma, checkDatabaseHealth } from '@legal-platform/database';

// Query database
const users = await prisma.user.findMany();

// Health check
const health = await checkDatabaseHealth();
console.log(`Database latency: ${health.latency}ms`);
```

### Health Check Endpoint

The database client includes a health check function for monitoring:

```typescript
GET /api/health/database

Response:
{
  "healthy": true,
  "latency": 15,
  "timestamp": "2025-11-20T10:00:00Z"
}
```

## Session Management

Redis is used for session storage with automatic expiration and cleanup.

### Session Configuration

| Parameter       | Default    | Description                                  |
| --------------- | ---------- | -------------------------------------------- |
| Session TTL     | 24 hours   | Session expiration time                      |
| Session Prefix  | `session:` | Key prefix for all sessions                  |
| Auto Expiration | Yes        | Redis automatically removes expired sessions |

### Session Usage

```typescript
import { sessionManager } from '@legal-platform/database';

// Store user session
await sessionManager.set('session-abc123', {
  userId: '123',
  role: 'Partner',
  firmId: 'firm-456',
  lastActivity: new Date().toISOString(),
});

// Retrieve session
const session = await sessionManager.get('session-abc123');
if (session) {
  console.log(`User ${session.userId} is a ${session.role}`);
}

// Refresh session TTL (extend expiration)
await sessionManager.refresh('session-abc123');

// Delete session (logout)
await sessionManager.delete('session-abc123');

// Delete all sessions for a user
await sessionManager.deleteUserSessions('123');
```

### Session Cleanup Job

A background job should run periodically to clean up expired sessions:

```typescript
import { sessionManager } from '@legal-platform/database';

// Run nightly at 2 AM
cron.schedule('0 2 * * *', async () => {
  const cleanedCount = await sessionManager.cleanup();
  console.log(`Cleaned up ${cleanedCount} expired sessions`);
});
```

## Caching Strategy

Redis caching improves API response times and reduces database load.

### Cache Configuration

| Parameter         | Default                   | Description                    |
| ----------------- | ------------------------- | ------------------------------ |
| Cache TTL         | 5 min                     | Default cache expiration time  |
| Cache Prefix      | `cache:`                  | Key prefix for all cached data |
| Cache Key Pattern | `{service}:{entity}:{id}` | Standard key naming            |

### Cache Usage

```typescript
import { cacheManager } from '@legal-platform/database';

// Cache API response
await cacheManager.set('case:123', caseData, 300); // 5 minutes

// Retrieve from cache
const cachedCase = await cacheManager.get('case:123');
if (cachedCase) {
  return cachedCase; // Return cached data
}

// Fetch from database if not cached
const freshCase = await prisma.case.findUnique({ where: { id: '123' } });
await cacheManager.set('case:123', freshCase);

// Invalidate cache on mutation
await prisma.case.update({ where: { id: '123' }, data: updates });
await cacheManager.delete('case:123'); // Remove stale cache

// Invalidate multiple caches by pattern
await cacheManager.invalidate('case:*'); // Clear all case caches
```

### Cache Metrics

Track cache hit/miss rates for optimization:

```typescript
import { cacheManager } from '@legal-platform/database';

const stats = await cacheManager.stats();
console.log(`Total keys: ${stats.totalKeys}`);
console.log(`Session keys: ${stats.sessionKeys}`);
console.log(`Cache keys: ${stats.cacheKeys}`);
console.log(`Memory used: ${stats.memoryUsed}`);
```

### Cache Invalidation Patterns

| Event                  | Invalidation Pattern          | Example                  |
| ---------------------- | ----------------------------- | ------------------------ |
| Case updated           | `case:{id}`                   | `case:123`               |
| Case deleted           | `case:{id}`                   | `case:123`               |
| Document added to case | `case:{caseId}`, `document:*` | `case:123`, `document:*` |
| User role changed      | `user:{userId}:*`             | `user:123:*`             |
| Firm data updated      | `firm:{firmId}:*`             | `firm:456:*`             |

## Dependencies

- PostgreSQL 16+
- pgvector 0.5+ (for vector similarity search)
- UUID extension (uuid-ossp)
- Trigram extension (pg_trgm)
- Prisma 5.8+

## Notes

- All tables use UUID primary keys for distributed system compatibility
- JSONB columns allow flexible metadata storage without schema changes
- Automatic triggers maintain data consistency and reduce application logic
- Indexes are optimized for read-heavy workloads typical of analytics queries
