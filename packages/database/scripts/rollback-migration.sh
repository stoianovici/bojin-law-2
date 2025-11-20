#!/bin/bash

# Prisma Migration Rollback Script
# Safely rolls back the most recent Prisma migration with safety checks

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}=== Prisma Migration Rollback ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/database"
    exit 1
fi

# Check if this is production environment
if [[ "$DATABASE_URL" == *"render.com"* ]] || [[ "$DATABASE_URL" == *"production"* ]]; then
    echo -e "${RED}⚠️  WARNING: Production database detected!${NC}"
    echo -e "${YELLOW}Rolling back migrations in production is risky and may cause data loss.${NC}"
    echo ""
    read -p "Are you ABSOLUTELY SURE you want to rollback production? (type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Rollback cancelled.${NC}"
        exit 0
    fi
fi

# Display current migration status
echo -e "${YELLOW}Current migration status:${NC}"
cd "$PROJECT_DIR"
npx prisma migrate status --schema=./prisma/schema.prisma || true
echo ""

# Get migration to rollback
echo -e "${YELLOW}Which migration do you want to rollback?${NC}"
echo "Enter the full migration name (e.g., 20250120123045_add_user_table)"
read -p "Migration name: " migration_name

if [ -z "$migration_name" ]; then
    echo -e "${RED}Error: No migration name provided${NC}"
    exit 1
fi

# Verify migration exists in database
echo -e "${YELLOW}Verifying migration exists...${NC}"
migration_exists=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name = '$migration_name' AND rolled_back_at IS NULL;")

if [ "$migration_exists" -eq 0 ]; then
    echo -e "${RED}Error: Migration '$migration_name' not found or already rolled back${NC}"
    echo "Run 'pnpm db:migrate:history' to see available migrations"
    exit 1
fi

echo -e "${GREEN}✓ Migration found${NC}"
echo ""

# Safety check: Backup reminder
echo -e "${YELLOW}⚠️  IMPORTANT: Have you created a backup of your database?${NC}"
echo "Create a backup now with: pnpm db:backup"
echo ""
read -p "Do you have a recent backup? (yes/no): " has_backup
if [ "$has_backup" != "yes" ]; then
    echo -e "${RED}Please create a backup before rolling back migrations!${NC}"
    exit 1
fi

# Require manual DOWN migration SQL
echo ""
echo -e "${YELLOW}Prisma does not generate automatic rollback SQL.${NC}"
echo "You must provide the DOWN migration SQL manually."
echo ""
echo -e "${YELLOW}Enter the DOWN migration SQL file path:${NC}"
echo "Example: ./migrations/down_$migration_name.sql"
read -p "DOWN SQL file path: " down_sql_path

if [ ! -f "$down_sql_path" ]; then
    echo -e "${RED}Error: DOWN SQL file not found: $down_sql_path${NC}"
    echo ""
    echo "Please create a DOWN migration SQL file that reverses the changes made by this migration."
    echo "Example for adding a table:"
    echo "  DROP TABLE IF EXISTS users;"
    exit 1
fi

# Display DOWN migration SQL for review
echo ""
echo -e "${YELLOW}DOWN migration SQL to be executed:${NC}"
echo -e "${BLUE}───────────────────────────────────────${NC}"
cat "$down_sql_path"
echo -e "${BLUE}───────────────────────────────────────${NC}"
echo ""

# Final confirmation
echo -e "${RED}⚠️  This will execute the DOWN migration SQL and mark the migration as rolled back.${NC}"
echo -e "${YELLOW}This operation cannot be undone automatically.${NC}"
echo ""
read -p "Are you sure you want to proceed? (type 'ROLLBACK' to confirm): " final_confirm

if [ "$final_confirm" != "ROLLBACK" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

# Execute rollback
echo ""
echo -e "${YELLOW}Executing DOWN migration...${NC}"

if psql "$DATABASE_URL" -f "$down_sql_path"; then
    echo -e "${GREEN}✓ DOWN migration executed successfully${NC}"
else
    echo -e "${RED}✗ DOWN migration failed!${NC}"
    echo "Your database may be in an inconsistent state."
    echo "Please review the error and consider restoring from backup."
    exit 1
fi

# Mark migration as rolled back in Prisma
echo -e "${YELLOW}Marking migration as rolled back in Prisma...${NC}"

npx prisma migrate resolve --rolled-back "$migration_name" --schema=./prisma/schema.prisma || {
    echo -e "${RED}Warning: Failed to mark migration as rolled back in Prisma${NC}"
    echo "You may need to manually update the _prisma_migrations table"
    exit 1
}

echo -e "${GREEN}✓ Migration marked as rolled back${NC}"
echo ""

# Verify rollback
echo -e "${YELLOW}Verifying rollback...${NC}"
npx prisma migrate status --schema=./prisma/schema.prisma
echo ""

echo -e "${GREEN}=== Rollback completed successfully ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify database state is correct"
echo "2. Run application tests to ensure no breakage"
echo "3. Consider creating a new migration if needed"
echo ""

exit 0
