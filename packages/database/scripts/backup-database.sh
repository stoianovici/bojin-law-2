#!/bin/bash

# Manual Database Backup Script
# Creates manual database backup using pg_dump or Render CLI
# Supports local and Render-hosted databases

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Manual Database Backup ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@host:5432/database"
    exit 1
fi

# Detect backup method
if [[ "$DATABASE_URL" == *"render.com"* ]]; then
    BACKUP_METHOD="render"
    echo -e "${YELLOW}Detected Render-hosted database${NC}"
else
    BACKUP_METHOD="pg_dump"
    echo -e "${YELLOW}Detected local/external PostgreSQL database${NC}"
fi

echo -e "${YELLOW}Backup method: $BACKUP_METHOD${NC}"
echo ""

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups"
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backups directory: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
fi

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ENV_NAME=$(if [[ "$DATABASE_URL" == *"production"* ]] || [[ "$DATABASE_URL" == *"render.com"* ]]; then echo "prod"; else echo "dev"; fi)
BACKUP_FILE="$BACKUP_DIR/backup-$ENV_NAME-$TIMESTAMP.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

echo -e "${YELLOW}Backup destination: $BACKUP_FILE${NC}"
echo ""

if [ "$BACKUP_METHOD" = "render" ]; then
    # Backup using Render CLI
    echo -e "${YELLOW}Using Render CLI for backup...${NC}"
    echo ""

    # Check if Render CLI is installed
    if ! command -v render &> /dev/null; then
        echo -e "${RED}Error: Render CLI not found${NC}"
        echo "Install Render CLI: https://render.com/docs/cli"
        echo "Or use pg_dump as fallback"
        exit 1
    fi

    # Extract database name from render.com URL if possible
    # For Render, we need the database service name
    echo -e "${YELLOW}Note: Render CLI requires database service name${NC}"
    echo "Find it in: Render Dashboard → Databases → Service Name"
    echo ""
    read -p "Enter Render database service name (e.g., bojin-law-db): " db_service_name

    if [ -z "$db_service_name" ]; then
        echo -e "${RED}Error: Database service name required${NC}"
        exit 1
    fi

    # Trigger Render backup
    echo -e "${YELLOW}Creating backup on Render...${NC}"
    if render db backup --database "$db_service_name"; then
        echo -e "${GREEN}✓ Render backup initiated successfully${NC}"
        echo ""
        echo -e "${BLUE}Backup stored in Render's backup system${NC}"
        echo "View backups: render db backups --database $db_service_name"
        echo "Restore: render db restore --database $db_service_name --backup [backup-id]"
    else
        echo -e "${RED}✗ Render backup failed${NC}"
        echo "Falling back to pg_dump..."
        BACKUP_METHOD="pg_dump"
    fi
fi

if [ "$BACKUP_METHOD" = "pg_dump" ]; then
    # Backup using pg_dump
    echo -e "${YELLOW}Using pg_dump for backup...${NC}"
    echo ""

    # Check if pg_dump is installed
    if ! command -v pg_dump &> /dev/null; then
        echo -e "${RED}Error: pg_dump not found${NC}"
        echo "Install PostgreSQL client tools"
        exit 1
    fi

    # Add metadata header
    echo -e "${YELLOW}Adding backup metadata...${NC}"
    cat > "$BACKUP_FILE" << EOF
-- Manual Database Backup
-- Backup Date: $(date +"%Y-%m-%d %H:%M:%S %Z")
-- Environment: $ENV_NAME
-- Database URL: ${DATABASE_URL%%@*}@...  (password hidden)
-- Created by: $(whoami)
-- Host: $(hostname)
--

EOF

    # Create backup
    echo -e "${YELLOW}Creating backup...${NC}"
    echo "This may take several minutes depending on database size..."
    echo ""

    if pg_dump "$DATABASE_URL" >> "$BACKUP_FILE" 2>&1; then
        echo -e "${GREEN}✓ Backup created successfully${NC}"
    else
        echo -e "${RED}✗ Backup failed!${NC}"
        echo "Check that pg_dump is installed and DATABASE_URL is correct"
        rm -f "$BACKUP_FILE"  # Clean up partial backup
        exit 1
    fi

    # Get backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}Backup file size: $BACKUP_SIZE${NC}"
    echo ""

    # Compress backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    if gzip -f "$BACKUP_FILE"; then
        echo -e "${GREEN}✓ Compression completed${NC}"
        COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
        echo -e "${GREEN}Compressed size: $COMPRESSED_SIZE${NC}"
        FINAL_FILE="$COMPRESSED_FILE"
    else
        echo -e "${YELLOW}Warning: Compression failed, keeping uncompressed file${NC}"
        FINAL_FILE="$BACKUP_FILE"
    fi

    echo ""
    echo -e "${GREEN}=== Backup completed successfully ===${NC}"
    echo ""
    echo -e "${BLUE}Backup file: $FINAL_FILE${NC}"
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify backup integrity (optional): pg_restore --list $FINAL_FILE"
echo "2. Store backup securely (encrypted storage recommended)"
echo "3. Test restore on staging environment"
echo "4. Document backup in operations log"
echo ""
echo -e "${YELLOW}Security reminders:${NC}"
echo "⚠️  Backup file may contain sensitive data"
echo "⚠️  Encrypt backup files at rest (AES-256)"
echo "⚠️  Limit access to DevOps team only"
echo "⚠️  Follow retention policy (keep 30 days of manual backups)"
echo ""

exit 0
