#!/usr/bin/env bash

# Quick local backup script - backs up production DB to local file
# Usage: ./scripts/backup/backup-now.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="legal_platform_prod_${TIMESTAMP}.sql.gz"

# Production database URL
PROD_DB="postgresql://legal_platform_user:8Cbf13wXosSZHY8q4ZC4YrXDobyiWMpy@dpg-d4q61v6r433s73agrcc0-a.oregon-postgres.render.com/legal_platform_prod_5brt"

echo "=== Production Database Backup ==="
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Add to gitignore if not already
if ! grep -q "db-backups/" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
  echo "db-backups/" >> "$PROJECT_ROOT/.gitignore"
  echo "Added db-backups/ to .gitignore"
fi

echo "Creating backup..."
pg_dump "$PROD_DB" --no-owner --no-acl 2>/dev/null | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo ""
echo "✓ Backup complete!"
echo "  File: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "  Size: ${SIZE}"
echo ""

# Show recent backups
echo "Recent backups:"
ls -lht "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -5

echo ""
echo "To restore: gunzip -c ${BACKUP_FILE} | psql \$DATABASE_URL"
