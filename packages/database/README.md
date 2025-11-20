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

### Running Migrations

To run all pending migrations:

```bash
# From project root
./packages/database/scripts/run-migration.sh

# Or run a specific migration
psql $DATABASE_URL -f packages/database/migrations/001_add_skills_tables.sql
```

### Migration Naming Convention

Migrations are named with the following pattern:

```
{number}_{description}.sql
```

Example: `001_add_skills_tables.sql`

### Current Migrations

| Migration                     | Description                                          | Date       |
| ----------------------------- | ---------------------------------------------------- | ---------- |
| 000_enable_extensions.sql     | Enable pgvector, uuid-ossp, pg_trgm extensions       | 2025-11-20 |
| 001_add_skills_tables.sql     | Add Claude Skills infrastructure tables              | 2025-11-19 |
| 002_add_discovery_tables.sql  | Add Document Type Discovery infrastructure tables    | 2025-11-19 |

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

| Variable                        | Description                        | Default | Example  |
| ------------------------------- | ---------------------------------- | ------- | -------- |
| `DATABASE_MAX_CONNECTIONS`      | Max database connections           | 20      | 20       |
| `DATABASE_POOL_SIZE`            | Pool size per service instance     | 10      | 10       |
| `DATABASE_CONNECTION_TIMEOUT`   | Connection timeout (milliseconds)  | 30000   | 30000    |
| `DATABASE_STATEMENT_TIMEOUT`    | Query timeout (milliseconds)       | 60000   | 60000    |
| `DATABASE_IDLE_TIMEOUT`         | Idle connection timeout (ms)       | 10000   | 10000    |
| `DATABASE_SSL_MODE`             | SSL mode for connections           | require | require  |

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

| Parameter         | Default | Description                           |
| ----------------- | ------- | ------------------------------------- |
| Session TTL       | 24 hours| Session expiration time               |
| Session Prefix    | `session:`| Key prefix for all sessions        |
| Auto Expiration   | Yes     | Redis automatically removes expired sessions |

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

| Parameter            | Default | Description                          |
| -------------------- | ------- | ------------------------------------ |
| Cache TTL            | 5 min   | Default cache expiration time        |
| Cache Prefix         | `cache:`| Key prefix for all cached data       |
| Cache Key Pattern    | `{service}:{entity}:{id}` | Standard key naming |

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

| Event                  | Invalidation Pattern        | Example                     |
| ---------------------- | --------------------------- | --------------------------- |
| Case updated           | `case:{id}`                 | `case:123`                  |
| Case deleted           | `case:{id}`                 | `case:123`                  |
| Document added to case | `case:{caseId}`, `document:*` | `case:123`, `document:*` |
| User role changed      | `user:{userId}:*`           | `user:123:*`                |
| Firm data updated      | `firm:{firmId}:*`           | `firm:456:*`                |

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
