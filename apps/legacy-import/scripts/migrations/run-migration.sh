#!/bin/bash
# Run migration script via SSH tunnel to production database
#
# Usage:
#   ./scripts/migrations/run-migration.sh 001-add-skip-reason.sql

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_FILE="${1:-001-add-skip-reason.sql}"

DB_HOST="localhost"
DB_PORT="5433"
DB_USER="legal_platform"
DB_NAME="legal_platform"
DB_PASSWORD="HTdJ9oAafB6uiecJlB3FImEop3hNG3LI"
REMOTE_HOST="root@135.181.44.197"
REMOTE_DB_HOST="10.0.1.7"

echo "=== Database Migration ==="
echo "Migration file: $MIGRATION_FILE"
echo ""

# Check if SSH tunnel is already running
if ! nc -z localhost 5433 2>/dev/null; then
    echo "Starting SSH tunnel to production database..."
    ssh -f -N -L 5433:${REMOTE_DB_HOST}:5432 ${REMOTE_HOST}
    sleep 2
    echo "SSH tunnel established on port 5433"
else
    echo "SSH tunnel already active on port 5433"
fi

# Run migration
echo ""
echo "Running migration..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "${SCRIPT_DIR}/${MIGRATION_FILE}"

echo ""
echo "=== Migration Complete ==="
