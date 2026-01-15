#!/bin/bash

# =============================================================================
# Push to Production Script
# Syncs local database TO production (DANGEROUS - use with caution)
# Usage: pnpm push:prod [--confirm] [--dry-run] [--no-backup]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse arguments
CONFIRM=false
DRY_RUN=false
NO_BACKUP=false

for arg in "$@"; do
    case $arg in
        --confirm)
            CONFIRM=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
    esac
done

echo ""
echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║            ⚠️  PUSH TO PRODUCTION ⚠️                          ║${NC}"
echo -e "${RED}${BOLD}║                                                              ║${NC}"
echo -e "${RED}${BOLD}║  This will OVERWRITE production database with local data!   ║${NC}"
echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# Step 1: Load and validate environment
# =============================================================================
echo -e "${YELLOW}[1/7] Validating environment...${NC}"

# Load PROD_DATABASE_URL from .env.local
if [ -z "$PROD_DATABASE_URL" ]; then
    if [ -f ".env.local" ]; then
        export $(grep -E '^PROD_DATABASE_URL=' .env.local | xargs)
    fi
fi

if [ -z "$PROD_DATABASE_URL" ]; then
    echo -e "${RED}ERROR: PROD_DATABASE_URL is not set${NC}"
    exit 1
fi

# Verify prod URL looks like production
if [[ "$PROD_DATABASE_URL" != *"render.com"* ]] && [[ "$PROD_DATABASE_URL" != *"production"* ]] && [[ "$PROD_DATABASE_URL" != *"prod"* ]]; then
    echo -e "${RED}ERROR: PROD_DATABASE_URL doesn't look like production${NC}"
    echo "This script only pushes to production databases for safety."
    exit 1
fi

echo -e "${GREEN}✓ Production URL validated${NC}"

# =============================================================================
# Step 2: Check Docker and local database
# =============================================================================
echo ""
echo -e "${YELLOW}[2/7] Checking local database...${NC}"

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running${NC}"
    exit 1
fi

# Find the postgres container
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'legal.*postgres' | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}ERROR: PostgreSQL container not found${NC}"
    exit 1
fi

# Determine which local database to push (prefer legal_platform_prod)
LOCAL_DB="legal_platform_prod"
if ! docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    LOCAL_DB="legal_platform"
    if ! docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${RED}ERROR: No local database found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Local database: $LOCAL_DB${NC}"

# =============================================================================
# Step 3: Show data comparison
# =============================================================================
echo ""
echo -e "${YELLOW}[3/7] Comparing local vs production...${NC}"

# Get local counts
LOCAL_USERS=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ')
LOCAL_CLIENTS=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM clients;" 2>/dev/null | tr -d ' ')
LOCAL_CASES=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM cases;" 2>/dev/null | tr -d ' ')
LOCAL_EMAILS=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM emails;" 2>/dev/null | tr -d ' ')
LOCAL_TASKS=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM tasks;" 2>/dev/null | tr -d ' ')
LOCAL_DOCS=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$LOCAL_DB" -t -c "SELECT count(*) FROM documents;" 2>/dev/null | tr -d ' ')

# Get production counts
PROD_USERS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ')
PROD_CLIENTS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM clients;" 2>/dev/null | tr -d ' ')
PROD_CASES=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM cases;" 2>/dev/null | tr -d ' ')
PROD_EMAILS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM emails;" 2>/dev/null | tr -d ' ')
PROD_TASKS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM tasks;" 2>/dev/null | tr -d ' ')
PROD_DOCS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM documents;" 2>/dev/null | tr -d ' ')

echo ""
echo -e "${BOLD}                LOCAL ($LOCAL_DB)    →    PRODUCTION${NC}"
echo "  ─────────────────────────────────────────────────────"
printf "  Users:        %8s              →    %8s\n" "$LOCAL_USERS" "$PROD_USERS"
printf "  Clients:      %8s              →    %8s\n" "$LOCAL_CLIENTS" "$PROD_CLIENTS"
printf "  Cases:        %8s              →    %8s\n" "$LOCAL_CASES" "$PROD_CASES"
printf "  Emails:       %8s              →    %8s\n" "$LOCAL_EMAILS" "$PROD_EMAILS"
printf "  Tasks:        %8s              →    %8s\n" "$LOCAL_TASKS" "$PROD_TASKS"
printf "  Documents:    %8s              →    %8s\n" "$LOCAL_DOCS" "$PROD_DOCS"
echo "  ─────────────────────────────────────────────────────"
echo ""

# =============================================================================
# Step 4: Dry run check
# =============================================================================
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}DRY RUN - No changes will be made${NC}"
    echo ""
    echo "Would perform:"
    echo "  1. Backup production database"
    echo "  2. Export local $LOCAL_DB"
    echo "  3. Drop all tables in production"
    echo "  4. Import local dump to production"
    echo ""
    exit 0
fi

# =============================================================================
# Step 5: Confirmation
# =============================================================================
echo ""
echo -e "${YELLOW}[4/7] Confirmation required...${NC}"

if [ "$CONFIRM" != true ]; then
    echo ""
    echo -e "${RED}${BOLD}THIS WILL PERMANENTLY OVERWRITE PRODUCTION DATA${NC}"
    echo ""
    echo -e "${YELLOW}You are about to:${NC}"
    echo "  • Delete ALL existing production data"
    echo "  • Replace it with your local $LOCAL_DB database"
    echo "  • This affects REAL USERS and REAL DATA"
    echo ""
    echo -e "${YELLOW}Type the following to confirm:${NC}"
    echo -e "${BOLD}PUSH TO PRODUCTION${NC}"
    echo ""
    read -p "> " confirm_input
    if [ "$confirm_input" != "PUSH TO PRODUCTION" ]; then
        echo ""
        echo -e "${YELLOW}Aborted. Production unchanged.${NC}"
        exit 0
    fi
fi

echo -e "${GREEN}✓ Confirmed${NC}"

# =============================================================================
# Step 6: Backup production (unless --no-backup)
# =============================================================================
echo ""
echo -e "${YELLOW}[5/7] Backing up production...${NC}"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$PROJECT_ROOT/backups"
mkdir -p "$BACKUP_DIR"

if [ "$NO_BACKUP" != true ]; then
    BACKUP_FILE="$BACKUP_DIR/prod-backup-before-push-$TIMESTAMP.sql.gz"

    if pg_dump "$PROD_DATABASE_URL" | gzip > "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}✓ Production backed up: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
    else
        echo -e "${RED}ERROR: Failed to backup production${NC}"
        echo "Use --no-backup to skip (dangerous)"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Skipping backup (--no-backup flag)${NC}"
fi

# =============================================================================
# Step 7: Export local and push to production
# =============================================================================
echo ""
echo -e "${YELLOW}[6/7] Exporting local database...${NC}"

LOCAL_DUMP="$BACKUP_DIR/local-push-$TIMESTAMP.sql"

if docker exec "$POSTGRES_CONTAINER" pg_dump -U postgres -d "$LOCAL_DB" > "$LOCAL_DUMP" 2>/dev/null; then
    DUMP_SIZE=$(du -h "$LOCAL_DUMP" | cut -f1)
    echo -e "${GREEN}✓ Local database exported ($DUMP_SIZE)${NC}"
else
    echo -e "${RED}ERROR: Failed to export local database${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}[7/7] Pushing to production...${NC}"
echo "This may take several minutes..."

# Drop and recreate all tables by using psql with the dump
# First, drop the schema and recreate it
psql "$PROD_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null 2>&1

if psql "$PROD_DATABASE_URL" < "$LOCAL_DUMP" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Production database updated${NC}"
else
    echo -e "${RED}ERROR: Failed to import to production${NC}"
    echo ""
    echo -e "${YELLOW}To restore from backup:${NC}"
    echo "  gunzip -c $BACKUP_FILE | psql \$PROD_DATABASE_URL"
    exit 1
fi

# Clean up local dump
rm -f "$LOCAL_DUMP"

# =============================================================================
# Step 8: Verify
# =============================================================================
echo ""
echo -e "${YELLOW}Verifying push...${NC}"

NEW_PROD_USERS=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ')
NEW_PROD_CASES=$(psql "$PROD_DATABASE_URL" -t -c "SELECT count(*) FROM cases;" 2>/dev/null | tr -d ' ')

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                    PUSH COMPLETE                             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Production now has:"
echo "  Users: $NEW_PROD_USERS"
echo "  Cases: $NEW_PROD_CASES"
echo ""
if [ "$NO_BACKUP" != true ]; then
    echo -e "${YELLOW}Backup saved:${NC} $BACKUP_FILE"
    echo ""
fi
echo -e "${YELLOW}Note:${NC} Users may need to re-login (sessions invalidated)"
echo ""
