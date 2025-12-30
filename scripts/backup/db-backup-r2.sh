#!/usr/bin/env bash

# Database Backup Script - Backs up PostgreSQL to Cloudflare R2
# Can be run manually or via Render Cron Job
#
# Required Environment Variables:
#   DATABASE_URL - PostgreSQL connection string
#   R2_ACCOUNT_ID - Cloudflare account ID
#   R2_ACCESS_KEY_ID - R2 access key
#   R2_SECRET_ACCESS_KEY - R2 secret key
#   R2_BUCKET_NAME - R2 bucket (default: legacy-import)
#   R2_ENDPOINT - R2 endpoint URL

set -euo pipefail

# Configuration
BACKUP_DIR="/tmp/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="legal_platform_backup_${TIMESTAMP}.sql.gz"
R2_PATH="db-backups/${BACKUP_FILE}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"; }
log_success() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $*"; }
log_error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $*" >&2; }

# Validate environment
validate_env() {
  local missing=()
  [[ -z "${DATABASE_URL:-}" ]] && missing+=("DATABASE_URL")
  [[ -z "${R2_ACCESS_KEY_ID:-}" ]] && missing+=("R2_ACCESS_KEY_ID")
  [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]] && missing+=("R2_SECRET_ACCESS_KEY")
  [[ -z "${R2_ENDPOINT:-}" ]] && missing+=("R2_ENDPOINT")

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing required environment variables: ${missing[*]}"
    exit 1
  fi
}

# Create backup
create_backup() {
  log "Creating database backup..."
  mkdir -p "$BACKUP_DIR"

  # Use pg_dump with compression
  pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

  local size=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  log_success "Backup created: ${BACKUP_FILE} (${size})"
}

# Upload to R2
upload_to_r2() {
  log "Uploading to Cloudflare R2..."

  local bucket="${R2_BUCKET_NAME:-legacy-import}"
  local file_path="${BACKUP_DIR}/${BACKUP_FILE}"

  # Use AWS CLI with R2 endpoint
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 cp "$file_path" "s3://${bucket}/${R2_PATH}" \
    --endpoint-url "$R2_ENDPOINT" \
    --no-progress

  log_success "Uploaded to R2: s3://${bucket}/${R2_PATH}"
}

# Cleanup old local backups
cleanup_local() {
  log "Cleaning up local backup files..."
  rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
  log_success "Local cleanup complete"
}

# Cleanup old R2 backups (keep last N days)
cleanup_old_r2_backups() {
  log "Cleaning up R2 backups older than ${RETENTION_DAYS} days..."

  local bucket="${R2_BUCKET_NAME:-legacy-import}"
  local cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)

  # List and delete old backups
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 ls "s3://${bucket}/db-backups/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | while read -r line; do

    local filename=$(echo "$line" | awk '{print $4}')
    # Extract date from filename (legal_platform_backup_YYYYMMDD_HHMMSS.sql.gz)
    local file_date=$(echo "$filename" | grep -oE '[0-9]{8}' | head -1)

    if [[ -n "$file_date" && "$file_date" < "$cutoff_date" ]]; then
      log "Deleting old backup: $filename"
      AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
      aws s3 rm "s3://${bucket}/db-backups/${filename}" \
        --endpoint-url "$R2_ENDPOINT" 2>/dev/null || true
    fi
  done

  log_success "R2 cleanup complete"
}

# Main
main() {
  log "=== Database Backup Started ==="

  validate_env
  create_backup
  upload_to_r2
  cleanup_local
  cleanup_old_r2_backups

  log_success "=== Database Backup Complete ==="
}

main "$@"
