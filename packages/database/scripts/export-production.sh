#!/bin/bash

# Production Database Export Script
# Exports production database to SQL file for dev/staging import
# Includes compression and metadata

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Production Database Export ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@host:5432/database"
    exit 1
fi

# Safety check: Ensure we're exporting FROM production
if [[ "$DATABASE_URL" != *"render.com"* ]] && [[ "$DATABASE_URL" != *"production"* ]]; then
    echo -e "${YELLOW}⚠️  WARNING: Database URL does not appear to be production${NC}"
    echo "Expected 'render.com' or 'production' in DATABASE_URL"
    echo ""
    read -p "Are you sure you want to export this database? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Export cancelled.${NC}"
        exit 0
    fi
fi

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups"
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backups directory: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
fi

# Generate export filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_FILE="$BACKUP_DIR/export-production-$TIMESTAMP.sql"
COMPRESSED_FILE="$EXPORT_FILE.gz"

echo -e "${YELLOW}Export destination: $EXPORT_FILE${NC}"
echo ""

# Metadata
echo -e "${YELLOW}Adding export metadata...${NC}"
cat > "$EXPORT_FILE" << EOF
-- Production Database Export
-- Export Date: $(date +"%Y-%m-%d %H:%M:%S %Z")
-- Database URL: ${DATABASE_URL%%@*}@...  (password hidden)
-- Exported by: $(whoami)
-- Host: $(hostname)
--
-- IMPORTANT: This export contains production data and should be anonymized
-- before use in development environments. Run anonymization script after import.
--

EOF

# Export database schema and data using pg_dump
echo -e "${YELLOW}Exporting database...${NC}"
echo "This may take several minutes depending on database size..."
echo ""

if pg_dump "$DATABASE_URL" >> "$EXPORT_FILE" 2>&1; then
    echo -e "${GREEN}✓ Database exported successfully${NC}"
else
    echo -e "${RED}✗ Export failed!${NC}"
    echo "Check that pg_dump is installed and DATABASE_URL is correct"
    rm -f "$EXPORT_FILE"  # Clean up partial export
    exit 1
fi

# Get export file size
EXPORT_SIZE=$(du -h "$EXPORT_FILE" | cut -f1)
echo -e "${GREEN}Export file size: $EXPORT_SIZE${NC}"
echo ""

# Compress export file
echo -e "${YELLOW}Compressing export file...${NC}"
if gzip -f "$EXPORT_FILE"; then
    echo -e "${GREEN}✓ Compression completed${NC}"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    echo -e "${GREEN}Compressed size: $COMPRESSED_SIZE${NC}"
else
    echo -e "${RED}✗ Compression failed${NC}"
    echo "Keeping uncompressed file: $EXPORT_FILE"
fi

echo ""
echo -e "${GREEN}=== Export completed successfully ===${NC}"
echo ""
echo -e "${BLUE}Export file: $COMPRESSED_FILE${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Transfer export file to local machine (if running remotely)"
echo "2. Import to development database: pnpm db:import:anonymized"
echo "3. CRITICAL: Run anonymization script after import!"
echo "4. Delete export file securely when no longer needed"
echo ""
echo -e "${YELLOW}Security reminders:${NC}"
echo "⚠️  Export file contains PRODUCTION DATA with real PII"
echo "⚠️  Store securely and encrypt if transferring"
echo "⚠️  Delete after import and anonymization"
echo "⚠️  Never commit to git or share publicly"
echo ""

exit 0
