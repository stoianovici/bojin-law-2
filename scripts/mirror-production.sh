#!/bin/bash

# =============================================================================
# Production Mirror Script
# Creates a local snapshot of production database for debugging
# Usage: pnpm mirror:prod [--confirm] [--dry-run]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse arguments
CONFIRM=false
DRY_RUN=false

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
    esac
done

echo -e "${BLUE}=== Production Mirror ===${NC}"
echo -e "${YELLOW}Creates a local snapshot of production for debugging${NC}"
echo ""

# =============================================================================
# Step 1: Safety checks
# =============================================================================
echo -e "${YELLOW}[1/7] Safety checks...${NC}"

# Check we're not accidentally running against production
LOCAL_DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/legal_platform}"
if [[ "$LOCAL_DB_URL" == *"render.com"* ]] || [[ "$LOCAL_DB_URL" == *"production"* ]]; then
    echo -e "${RED}ERROR: DATABASE_URL points to production!${NC}"
    echo "This script imports INTO local, not from production."
    echo "Unset DATABASE_URL or point it to localhost."
    exit 1
fi

# Check PROD_DATABASE_URL is set
if [ -z "$PROD_DATABASE_URL" ]; then
    # Try to load from .env.local
    if [ -f ".env.local" ]; then
        export $(grep -E '^PROD_DATABASE_URL=' .env.local | xargs)
    fi
fi

if [ -z "$PROD_DATABASE_URL" ]; then
    echo -e "${RED}ERROR: PROD_DATABASE_URL is not set${NC}"
    echo ""
    echo "Set it in your environment or .env.local:"
    echo "  export PROD_DATABASE_URL=postgresql://user:pass@host:5432/dbname"
    echo ""
    echo "Or add to .env.local:"
    echo "  PROD_DATABASE_URL=postgresql://..."
    exit 1
fi

# Verify prod URL looks like production
if [[ "$PROD_DATABASE_URL" != *"render.com"* ]] && [[ "$PROD_DATABASE_URL" != *"production"* ]] && [[ "$PROD_DATABASE_URL" != *"prod"* ]]; then
    echo -e "${YELLOW}WARNING: PROD_DATABASE_URL doesn't look like production${NC}"
    echo "URL: ${PROD_DATABASE_URL%%@*}@..."
    if [ "$CONFIRM" != true ]; then
        read -p "Continue anyway? [y/N]: " choice
        if [[ ! "$choice" =~ ^[Yy]$ ]]; then
            echo "Aborted."
            exit 0
        fi
    fi
fi

echo -e "${GREEN}✓ Safety checks passed${NC}"

# =============================================================================
# Step 2: Check Docker is running
# =============================================================================
echo ""
echo -e "${YELLOW}[2/7] Checking Docker...${NC}"

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running${NC}"
    echo "Please start Docker Desktop."
    exit 1
fi

# Check PostgreSQL container
if ! docker ps -q -f name=legal-postgres > /dev/null 2>&1 && \
   ! docker ps -q -f name=legal-platform-postgres > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting database containers...${NC}"
    docker compose up -d postgres redis 2>/dev/null || \
    docker compose -f infrastructure/docker/docker-compose.yml up -d postgres redis
fi

# Find the postgres container name
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'legal.*postgres' | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}ERROR: PostgreSQL container not found${NC}"
    exit 1
fi

# Find Redis container
REDIS_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'legal.*redis' | head -1)

echo -e "${GREEN}✓ Docker running (postgres: $POSTGRES_CONTAINER)${NC}"

# =============================================================================
# Step 3: Confirmation
# =============================================================================
echo ""
echo -e "${YELLOW}[3/7] Confirmation...${NC}"

if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}DRY RUN - No changes will be made${NC}"
    echo ""
    echo "Would perform:"
    echo "  1. Export production database"
    echo "  2. Drop local legal_platform_prod database"
    echo "  3. Import production dump"
    echo "  4. Clean sync artifacts (EmailSyncState, GraphSubscription)"
    echo "  5. Flush Redis cache"
    echo ""
    exit 0
fi

if [ "$CONFIRM" != true ]; then
    echo -e "${RED}WARNING: This will REPLACE your local database with production data${NC}"
    echo ""
    echo "What will happen:"
    echo "  - Local legal_platform_prod database will be dropped"
    echo "  - Production data will be imported (real client names, cases, emails)"
    echo "  - Sync artifacts will be cleaned (no stale delta tokens)"
    echo "  - Redis cache will be flushed"
    echo ""
    echo -e "${YELLOW}This contains REAL PRODUCTION DATA - handle with care${NC}"
    echo ""
    read -p "Type 'mirror' to confirm: " confirm_input
    if [ "$confirm_input" != "mirror" ]; then
        echo "Aborted."
        exit 0
    fi
fi

echo -e "${GREEN}✓ Confirmed${NC}"

# =============================================================================
# Step 4: Export production database
# =============================================================================
echo ""
echo -e "${YELLOW}[4/7] Exporting production database...${NC}"
echo "This may take a few minutes depending on database size..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$PROJECT_ROOT/backups"
mkdir -p "$BACKUP_DIR"
DUMP_FILE="$BACKUP_DIR/mirror-$TIMESTAMP.sql"

# Export using pg_dump
if pg_dump "$PROD_DATABASE_URL" > "$DUMP_FILE" 2>&1; then
    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Exported production database ($DUMP_SIZE)${NC}"
else
    echo -e "${RED}ERROR: Failed to export production database${NC}"
    echo "Check PROD_DATABASE_URL and ensure pg_dump is installed"
    rm -f "$DUMP_FILE"
    exit 1
fi

# =============================================================================
# Step 5: Import to local database
# =============================================================================
echo ""
echo -e "${YELLOW}[5/7] Importing to local database...${NC}"

# Create database if not exists
docker exec "$POSTGRES_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS legal_platform_prod;" 2>/dev/null || true
docker exec "$POSTGRES_CONTAINER" psql -U postgres -c "CREATE DATABASE legal_platform_prod;" 2>/dev/null || true

# Enable pgvector extension
docker exec "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# Import dump
if docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod < "$DUMP_FILE" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Imported to legal_platform_prod${NC}"
else
    echo -e "${RED}ERROR: Failed to import database${NC}"
    exit 1
fi

# Clean up dump file
rm -f "$DUMP_FILE"
echo -e "${GREEN}✓ Cleaned up temporary dump file${NC}"

# =============================================================================
# Step 6: Clean sync artifacts
# =============================================================================
echo ""
echo -e "${YELLOW}[6/7] Cleaning sync artifacts...${NC}"

# Run cleanup script
cd "$PROJECT_ROOT/packages/database"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_platform_prod" \
    pnpm exec tsx scripts/clean-sync-artifacts.ts

cd "$PROJECT_ROOT"
echo -e "${GREEN}✓ Sync artifacts cleaned${NC}"

# Flush Redis
if [ -n "$REDIS_CONTAINER" ]; then
    echo "Flushing Redis cache..."
    docker exec "$REDIS_CONTAINER" redis-cli FLUSHALL > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ Redis cache flushed${NC}"
fi

# =============================================================================
# Step 7: Switch to prod database and verify
# =============================================================================
echo ""
echo -e "${YELLOW}[7/7] Switching to production mirror...${NC}"

# Update .env files to point to prod database
./scripts/switch-db.sh prod 2>/dev/null || true

# Verify import
USER_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d ' ')
CASE_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod -t -c "SELECT count(*) FROM cases;" 2>/dev/null | tr -d ' ')
EMAIL_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod -t -c "SELECT count(*) FROM emails;" 2>/dev/null | tr -d ' ')
CLIENT_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -d legal_platform_prod -t -c "SELECT count(*) FROM clients;" 2>/dev/null | tr -d ' ')

echo -e "${GREEN}✓ Database switched to legal_platform_prod${NC}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}=== Mirror Complete ===${NC}"
echo ""
echo "Local database now contains production snapshot:"
echo "  Users:   $USER_COUNT"
echo "  Clients: $CLIENT_COUNT"
echo "  Cases:   $CASE_COUNT"
echo "  Emails:  $EMAIL_COUNT"
echo ""
echo "Database: postgresql://postgres:postgres@localhost:5432/legal_platform_prod"
echo ""
echo -e "${YELLOW}What was cleaned:${NC}"
echo "  - EmailSyncState delta tokens (prevents stale sync)"
echo "  - GraphSubscription records (webhook URLs are env-specific)"
echo "  - Redis cache (stale sessions)"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "  - Email/document attachments show metadata only (files in prod)"
echo "  - Graph API calls will fail (no local Microsoft 365)"
echo "  - This is READ-ONLY debugging - don't sync back to prod"
echo ""
echo "To switch back to seed database:"
echo -e "  ${BLUE}pnpm db:use:seed${NC}"
echo ""
