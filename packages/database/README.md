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

| Migration                 | Description                             | Date       |
| ------------------------- | --------------------------------------- | ---------- |
| 001_add_skills_tables.sql | Add Claude Skills infrastructure tables | 2025-11-19 |

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

## Dependencies

- PostgreSQL 14+
- UUID extension (usually enabled by default)
- JSONB support (built into PostgreSQL)

## Notes

- All tables use UUID primary keys for distributed system compatibility
- JSONB columns allow flexible metadata storage without schema changes
- Automatic triggers maintain data consistency and reduce application logic
- Indexes are optimized for read-heavy workloads typical of analytics queries
