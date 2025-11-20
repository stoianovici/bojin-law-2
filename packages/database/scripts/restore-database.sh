#!/bin/bash

# Database Restore Script
# Restores database from backup with safety checks
# Supports Render backups and local pg_dump backups

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Database Restore ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/database"
    exit 1
fi

# Detect database type
if [[ "$DATABASE_URL" == *"render.com"* ]]; then
    DB_TYPE="render"
    echo -e "${YELLOW}Detected Render-hosted database${NC}"
else
    DB_TYPE="local"
    echo -e "${YELLOW}Detected local/external PostgreSQL database${NC}"
fi
echo ""

# Critical safety check for production
if [[ "$DATABASE_URL" == *"production"* ]] && [ "$DB_TYPE" = "local" ]; then
    echo -e "${RED}⚠️  CRITICAL WARNING: Production database detected!${NC}"
    echo -e "${YELLOW}Restoring will OVERWRITE all current data!${NC}"
    echo ""
    read -p "Are you ABSOLUTELY SURE? (type 'restore-production' to confirm): " confirm
    if [ "$confirm" != "restore-production" ]; then
        echo -e "${YELLOW}Restore cancelled.${NC}"
        exit 0
    fi
fi

# Environment verification
echo -e "${YELLOW}Target database environment:${NC}"
if [[ "$DATABASE_URL" == *"production"* ]] || [[ "$DATABASE_URL" == *"render.com"* ]]; then
    echo -e "${RED}PRODUCTION${NC}"
else
    echo -e "${GREEN}DEVELOPMENT/STAGING${NC}"
fi
echo ""

# Choose restore method
echo -e "${YELLOW}Select restore method:${NC}"
echo "1. Restore from Render backup (Render-hosted databases)"
echo "2. Restore from local pg_dump backup file"
echo ""
read -p "Enter choice (1 or 2): " restore_method

if [ "$restore_method" = "1" ]; then
    # Render restore
    echo ""
    echo -e "${BLUE}=== Render Backup Restore ===${NC}"
    echo ""

    # Check if Render CLI is installed
    if ! command -v render &> /dev/null; then
        echo -e "${RED}Error: Render CLI not found${NC}"
        echo "Install Render CLI: https://render.com/docs/cli"
        exit 1
    fi

    # Get database service name
    echo -e "${YELLOW}Enter Render database service name:${NC}"
    echo "Find it in: Render Dashboard → Databases → Service Name"
    read -p "Service name: " db_service_name

    if [ -z "$db_service_name" ]; then
        echo -e "${RED}Error: Database service name required${NC}"
        exit 1
    fi

    # List available backups
    echo ""
    echo -e "${YELLOW}Available backups:${NC}"
    render db backups --database "$db_service_name"
    echo ""

    # Get backup ID
    echo -e "${YELLOW}Enter backup ID to restore:${NC}"
    read -p "Backup ID: " backup_id

    if [ -z "$backup_id" ]; then
        echo -e "${RED}Error: Backup ID required${NC}"
        exit 1
    fi

    # Final confirmation
    echo ""
    echo -e "${RED}⚠️  This will RESTORE the database from backup!${NC}"
    echo -e "${YELLOW}All current data will be replaced with backup data.${NC}"
    echo ""
    read -p "Are you sure? (type 'RESTORE' to confirm): " final_confirm

    if [ "$final_confirm" != "RESTORE" ]; then
        echo -e "${YELLOW}Restore cancelled.${NC}"
        exit 0
    fi

    # Perform Render restore
    echo ""
    echo -e "${YELLOW}Initiating restore...${NC}"
    if render db restore --database "$db_service_name" --backup "$backup_id"; then
        echo -e "${GREEN}✓ Restore initiated successfully${NC}"
        echo ""
        echo -e "${YELLOW}Waiting for restore to complete...${NC}"
        echo "This may take 5-15 minutes depending on database size"
        echo ""
        echo "Check status: render db status --database $db_service_name"
    else
        echo -e "${RED}✗ Restore failed!${NC}"
        exit 1
    fi

elif [ "$restore_method" = "2" ]; then
    # Local pg_dump restore
    echo ""
    echo -e "${BLUE}=== Local Backup Restore ===${NC}"
    echo ""

    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}Error: psql not found${NC}"
        echo "Install PostgreSQL client tools"
        exit 1
    fi

    # Get backup file
    echo -e "${YELLOW}Enter path to backup file:${NC}"
    echo "Example: ./backups/backup-dev-20250120-143000.sql.gz"
    read -p "Backup file: " backup_file

    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not found: $backup_file${NC}"
        exit 1
    fi

    # Check if compressed
    if [[ "$backup_file" == *.gz ]]; then
        IS_COMPRESSED=true
        echo -e "${YELLOW}Detected compressed backup (.gz)${NC}"
    else
        IS_COMPRESSED=false
        echo -e "${YELLOW}Detected uncompressed backup (.sql)${NC}"
    fi
    echo ""

    # Create backup of current database before restore (backup-before-restore)
    echo -e "${YELLOW}Creating safety backup of current database...${NC}"
    SAFETY_BACKUP_DIR="./backups"
    mkdir -p "$SAFETY_BACKUP_DIR"
    SAFETY_BACKUP_FILE="$SAFETY_BACKUP_DIR/backup-before-restore-$(date +%Y%m%d-%H%M%S).sql.gz"

    if pg_dump "$DATABASE_URL" | gzip > "$SAFETY_BACKUP_FILE" 2>&1; then
        echo -e "${GREEN}✓ Safety backup created: $SAFETY_BACKUP_FILE${NC}"
    else
        echo -e "${RED}Warning: Failed to create safety backup${NC}"
        read -p "Continue anyway? (yes/no): " continue_anyway
        if [ "$continue_anyway" != "yes" ]; then
            echo -e "${YELLOW}Restore cancelled.${NC}"
            exit 0
        fi
    fi
    echo ""

    # Get database name
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    echo -e "${YELLOW}Database: $DB_NAME${NC}"
    echo ""

    # Stop application services reminder
    echo -e "${RED}⚠️  IMPORTANT: Stop all application services before restore!${NC}"
    echo "This prevents write conflicts during restore."
    echo ""
    read -p "Have you stopped all services? (yes/no): " services_stopped
    if [ "$services_stopped" != "yes" ]; then
        echo -e "${YELLOW}Please stop services first, then re-run this script.${NC}"
        exit 0
    fi
    echo ""

    # Final confirmation
    echo -e "${RED}⚠️  This will DROP and RECREATE the database!${NC}"
    echo -e "${YELLOW}All current data will be replaced with backup data.${NC}"
    echo ""
    echo "Target database: $DB_NAME"
    echo "Backup file: $backup_file"
    echo ""
    read -p "Are you ABSOLUTELY SURE? (type 'RESTORE' to confirm): " final_confirm

    if [ "$final_confirm" != "RESTORE" ]; then
        echo -e "${YELLOW}Restore cancelled.${NC}"
        exit 0
    fi

    # Drop and recreate database
    echo ""
    echo -e "${YELLOW}Dropping existing database...${NC}"
    if dropdb "$DB_NAME" 2>/dev/null; then
        echo -e "${GREEN}✓ Database dropped${NC}"
    else
        echo -e "${YELLOW}Note: Database did not exist or could not be dropped${NC}"
    fi

    echo -e "${YELLOW}Creating fresh database...${NC}"
    if createdb "$DB_NAME"; then
        echo -e "${GREEN}✓ Database created${NC}"
    else
        echo -e "${RED}✗ Failed to create database${NC}"
        echo "Attempting to restore from safety backup..."
        gunzip -c "$SAFETY_BACKUP_FILE" | psql "$DATABASE_URL"
        exit 1
    fi
    echo ""

    # Restore from backup
    echo -e "${YELLOW}Restoring from backup...${NC}"
    echo "This may take several minutes..."
    echo ""

    if [ "$IS_COMPRESSED" = true ]; then
        # Decompress and restore
        if gunzip -c "$backup_file" | psql "$DATABASE_URL" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Restore completed successfully${NC}"
        else
            echo -e "${RED}✗ Restore failed!${NC}"
            echo "Attempting to restore from safety backup..."
            gunzip -c "$SAFETY_BACKUP_FILE" | psql "$DATABASE_URL"
            exit 1
        fi
    else
        # Restore uncompressed file
        if psql "$DATABASE_URL" < "$backup_file" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Restore completed successfully${NC}"
        else
            echo -e "${RED}✗ Restore failed!${NC}"
            echo "Attempting to restore from safety backup..."
            gunzip -c "$SAFETY_BACKUP_FILE" | psql "$DATABASE_URL"
            exit 1
        fi
    fi

else
    echo -e "${RED}Invalid choice${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Restore completed ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify database connectivity"
echo "2. Run schema validation: pnpm db:migrate:status"
echo "3. Run data integrity checks: pnpm db:validate"
echo "4. Restart application services"
echo "5. Monitor application logs for errors"
echo "6. Perform smoke tests on critical workflows"
echo ""
echo -e "${YELLOW}Rollback (if restore failed):${NC}"
if [ "$restore_method" = "2" ] && [ -n "$SAFETY_BACKUP_FILE" ]; then
    echo "Safety backup available: $SAFETY_BACKUP_FILE"
    echo "Restore from safety backup if issues detected"
fi
echo ""

exit 0
