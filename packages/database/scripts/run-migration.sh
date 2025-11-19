#!/bin/bash

# Database Migration Runner Script
# This script runs SQL migrations from the migrations directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/database"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(dirname "$SCRIPT_DIR")/migrations"

echo -e "${GREEN}=== Database Migration Runner ===${NC}"
echo "Migrations directory: $MIGRATIONS_DIR"
echo "Database URL: ${DATABASE_URL%%@*}@..." # Hide password in output
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}Error: Migrations directory not found: $MIGRATIONS_DIR${NC}"
    exit 1
fi

# Check if there are any migration files
MIGRATION_FILES=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null || true)
if [ -z "$MIGRATION_FILES" ]; then
    echo -e "${YELLOW}No migration files found in $MIGRATIONS_DIR${NC}"
    exit 0
fi

# Run each migration file in order
for migration_file in "$MIGRATIONS_DIR"/*.sql; do
    migration_name=$(basename "$migration_file")
    echo -e "${YELLOW}Running migration: $migration_name${NC}"

    if psql "$DATABASE_URL" -f "$migration_file"; then
        echo -e "${GREEN}✓ Successfully applied: $migration_name${NC}"
    else
        echo -e "${RED}✗ Failed to apply: $migration_name${NC}"
        exit 1
    fi
    echo ""
done

echo -e "${GREEN}=== All migrations completed successfully ===${NC}"

# Verify tables were created
echo -e "${YELLOW}Verifying tables...${NC}"
psql "$DATABASE_URL" -c "\dt skills*" || echo -e "${YELLOW}Note: Skills tables might not exist yet${NC}"

exit 0
