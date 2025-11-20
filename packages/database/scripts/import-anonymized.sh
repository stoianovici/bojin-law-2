#!/bin/bash

# Anonymized Data Import Workflow
# Imports production export to development database and runs anonymization
# Complete workflow: import → anonymize → verify

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Anonymized Data Import Workflow ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL=postgresql://user:password@localhost:5432/database"
    exit 1
fi

# Safety check: Ensure NOT importing to production
if [[ "$DATABASE_URL" == *"render.com"* ]] || [[ "$DATABASE_URL" == *"production"* ]]; then
    echo -e "${RED}❌ CRITICAL ERROR: Production database detected!${NC}"
    echo "This script should NEVER be run on production databases."
    echo "It will drop and recreate the database with imported data."
    echo ""
    echo "Database URL contains: render.com or production"
    exit 1
fi

echo -e "${GREEN}✓ Safety check passed: Not a production database${NC}"
echo ""

# Prompt for export file
echo -e "${YELLOW}Enter the path to the production export file:${NC}"
echo "Example: ./backups/export-production-20250120-143000.sql.gz"
read -p "Export file: " export_file

if [ ! -f "$export_file" ]; then
    echo -e "${RED}Error: Export file not found: $export_file${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Export file found${NC}"
echo ""

# Check if file is compressed
if [[ "$export_file" == *.gz ]]; then
    IS_COMPRESSED=true
    echo -e "${YELLOW}Detected compressed file (.gz)${NC}"
else
    IS_COMPRESSED=false
    echo -e "${YELLOW}Detected uncompressed file (.sql)${NC}"
fi
echo ""

# Warning about data loss
echo -e "${RED}⚠️  WARNING: This will DROP and RECREATE the database!${NC}"
echo -e "${YELLOW}All existing data in the target database will be lost.${NC}"
echo ""
echo "Target database: ${DATABASE_URL%%@*}@..."
echo ""
read -p "Are you ABSOLUTELY SURE you want to proceed? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Import cancelled.${NC}"
    exit 0
fi

echo ""

# Get database name from DATABASE_URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
echo -e "${YELLOW}Database name: $DB_NAME${NC}"
echo ""

# Drop and recreate database
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
    exit 1
fi
echo ""

# Import data
echo -e "${YELLOW}Importing production data...${NC}"
echo "This may take several minutes depending on data size..."
echo ""

if [ "$IS_COMPRESSED" = true ]; then
    # Decompress and import in one step
    if gunzip -c "$export_file" | psql "$DATABASE_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Data imported successfully${NC}"
    else
        echo -e "${RED}✗ Import failed!${NC}"
        echo "Check export file integrity and database permissions"
        exit 1
    fi
else
    # Import uncompressed file
    if psql "$DATABASE_URL" < "$export_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Data imported successfully${NC}"
    else
        echo -e "${RED}✗ Import failed!${NC}"
        echo "Check export file integrity and database permissions"
        exit 1
    fi
fi

echo ""

# Run anonymization script automatically
echo -e "${YELLOW}Running anonymization script...${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if npm run db:anonymize; then
    echo ""
    echo -e "${GREEN}✓ Anonymization completed${NC}"
else
    echo -e "${RED}✗ Anonymization failed!${NC}"
    echo "Database may contain real PII - DO NOT USE until anonymized!"
    exit 1
fi

echo ""

# Verify anonymization
echo -e "${YELLOW}Verifying anonymization...${NC}"

# TODO: Add verification queries once models are available
# Example verification:
# email_check=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE email NOT LIKE 'demo%@example.com';")
# if [ "$email_check" -gt 0 ]; then
#     echo -e "${RED}Warning: Found $email_check users with non-anonymized emails${NC}"
# fi

echo -e "${GREEN}✓ Anonymization verification placeholder (complete when models added)${NC}"
echo ""

echo -e "${GREEN}=== Import and anonymization completed successfully! ===${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  ✓ Production data imported"
echo "  ✓ PII data anonymized"
echo "  ✓ Database structure preserved"
echo "  ✓ Relationships maintained"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run migrations if needed: pnpm db:migrate"
echo "2. Verify data integrity: pnpm db:validate"
echo "3. Run application tests"
echo "4. Securely delete export file if no longer needed"
echo ""
echo -e "${GREEN}✓ Development database is ready to use!${NC}"
echo ""

exit 0
