#!/bin/bash

# =============================================================================
# Database Switcher for Legal Platform
# Switches between seed and prod databases
# Usage: ./scripts/switch-db.sh [prod|seed|dev]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse argument
DB_NAME=$1

if [[ "$DB_NAME" != "prod" && "$DB_NAME" != "seed" && "$DB_NAME" != "dev" ]]; then
    echo -e "${BLUE}Database Switcher for Legal Platform${NC}"
    echo ""
    echo "Usage:"
    echo -e "  ${GREEN}pnpm db:use:seed${NC}  - Switch to seed database (clean test data)"
    echo -e "  ${GREEN}pnpm db:use:prod${NC}  - Switch to prod database (imported production data)"
    echo -e "  ${GREEN}pnpm db:use:dev${NC}   - Switch to dev database (legacy, backwards compat)"
    echo ""
    echo "Current database:"

    # Detect current database from .env.local
    if [ -f ".env.local" ]; then
        CURRENT_DB=$(grep "DATABASE_URL" .env.local 2>/dev/null | head -1 | sed 's/.*\/\([^?]*\).*/\1/')
        echo -e "  ${YELLOW}$CURRENT_DB${NC}"
    else
        echo -e "  ${RED}No .env.local found${NC}"
    fi

    exit 0
fi

TARGET_DB="legal_platform_$DB_NAME"

echo -e "${BLUE}Switching to database: ${GREEN}$TARGET_DB${NC}"

# Function to update DATABASE_URL in a file
update_env_file() {
    local file=$1
    if [ -f "$file" ]; then
        # Check if file contains DATABASE_URL
        if grep -q "DATABASE_URL" "$file" 2>/dev/null; then
            # Replace the database name in the URL (try BSD sed first, then GNU)
            # Note: regex handles both 'legal_platform' (no suffix) and 'legal_platform_xxx' (with suffix)
            if sed -i '' "s|legal_platform\(_[a-z_]*\)\{0,1\}|$TARGET_DB|g" "$file" 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} Updated $file"
            elif sed -i "s|legal_platform\(_[a-z_]*\)\{0,1\}|$TARGET_DB|g" "$file" 2>/dev/null; then
                echo -e "  ${GREEN}✓${NC} Updated $file"
            fi
        fi
    fi
}

# Update all env files that might have DATABASE_URL
update_env_file ".env.local"
update_env_file ".env"
update_env_file "services/gateway/.env"
update_env_file "packages/database/.env"
update_env_file "apps/web/.env.local"

# Verify the change
echo ""
echo -e "${GREEN}✓ Switched to database: $TARGET_DB${NC}"
echo ""
echo -e "${YELLOW}Restart your dev server to apply changes.${NC}"
echo ""

# Show database status
if docker exec legal-platform-postgres psql -U postgres -d "$TARGET_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    USER_COUNT=$(docker exec legal-platform-postgres psql -U postgres -d "$TARGET_DB" -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
    CASE_COUNT=$(docker exec legal-platform-postgres psql -U postgres -d "$TARGET_DB" -t -c "SELECT count(*) FROM cases;" 2>/dev/null | tr -d ' ' || echo "0")

    echo "Database status:"
    echo -e "  Users: ${BLUE}$USER_COUNT${NC}"
    echo -e "  Cases: ${BLUE}$CASE_COUNT${NC}"
else
    echo -e "${YELLOW}Note: Database $TARGET_DB may not have migrations applied yet.${NC}"
    echo "Run 'pnpm db:migrate:deploy' in packages/database to apply migrations."
fi
