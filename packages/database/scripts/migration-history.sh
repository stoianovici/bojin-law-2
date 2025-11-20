#!/bin/bash

# Prisma Migration History Viewer
# Displays migration history from the _prisma_migrations table

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Prisma Migration History ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/database"
    exit 1
fi

# Check if _prisma_migrations table exists
table_exists=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_prisma_migrations');")

if [[ "$table_exists" != *"t"* ]]; then
    echo -e "${YELLOW}No migration history found.${NC}"
    echo "The _prisma_migrations table does not exist yet."
    echo "Run your first migration with: pnpm db:migrate"
    exit 0
fi

# Get migration count
migration_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM _prisma_migrations;")

if [ "$migration_count" -eq 0 ]; then
    echo -e "${YELLOW}No migrations applied yet.${NC}"
    echo "Run your first migration with: pnpm db:migrate"
    exit 0
fi

echo -e "${GREEN}Total migrations: $migration_count${NC}"
echo ""

# Display migration history with formatted output
echo -e "${CYAN}Migration History:${NC}"
echo -e "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"

psql "$DATABASE_URL" << 'EOF'
\pset border 2
\pset format wrapped
\x off

SELECT
    migration_name,
    TO_CHAR(finished_at, 'YYYY-MM-DD HH24:MI:SS') as applied_at,
    applied_steps_count as steps,
    CASE
        WHEN rolled_back_at IS NOT NULL THEN 'ROLLED BACK'
        ELSE 'APPLIED'
    END as status,
    CASE
        WHEN rolled_back_at IS NOT NULL THEN TO_CHAR(rolled_back_at, 'YYYY-MM-DD HH24:MI:SS')
        ELSE '-'
    END as rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC;
EOF

echo ""
echo -e "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"
echo ""

# Show pending migrations (if any)
echo -e "${YELLOW}Checking for pending migrations...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"
npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 | grep -A 20 "Following migration.*not been applied" || echo -e "${GREEN}✓ All migrations up to date${NC}"

echo ""

# Show migration checksums (for verification)
echo -e "${YELLOW}Recent migration checksums (for verification):${NC}"
psql "$DATABASE_URL" -t -c "SELECT migration_name, LEFT(checksum, 16) || '...' as checksum_preview FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;"

echo ""
echo -e "${CYAN}Commands:${NC}"
echo "  pnpm db:migrate:status  - Check migration status"
echo "  pnpm db:migrate         - Create and apply new migration"
echo "  pnpm db:migrate:undo    - Rollback a migration"
echo ""

exit 0
