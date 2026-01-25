#!/usr/bin/env bash

# Database Backup Script with Discord Notifications
# Backs up PostgreSQL to Cloudflare R2 and notifies on success/failure
#
# Required Environment Variables:
#   DATABASE_URL - PostgreSQL connection string
#   R2_ACCESS_KEY_ID - Cloudflare R2 access key
#   R2_SECRET_ACCESS_KEY - Cloudflare R2 secret key
#   R2_ENDPOINT - R2 endpoint URL
#   R2_BUCKET_NAME - R2 bucket (default: legal-platform-backups)
#
# Optional:
#   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)
#   DISCORD_WEBHOOK_URL - Discord webhook for notifications

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
BACKUP_DIR="/tmp/db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="legal_platform_backup_${TIMESTAMP}.sql.gz"
R2_PATH="db-backups/${BACKUP_FILE}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BUCKET="${R2_BUCKET_NAME:-legal-platform-backups}"

# Source the notification helper
notify() {
  if [[ -f "${SCRIPT_DIR}/discord-notify.sh" ]]; then
    "${SCRIPT_DIR}/discord-notify.sh" "$@" || true
  fi
}

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Cleanup on exit
cleanup() {
  rm -f "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null || true
}
trap cleanup EXIT

# Validate environment
validate_env() {
  local missing=()
  [[ -z "${DATABASE_URL:-}" ]] && missing+=("DATABASE_URL")
  [[ -z "${R2_ACCESS_KEY_ID:-}" ]] && missing+=("R2_ACCESS_KEY_ID")
  [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]] && missing+=("R2_SECRET_ACCESS_KEY")
  [[ -z "${R2_ENDPOINT:-}" ]] && missing+=("R2_ENDPOINT")

  if [[ ${#missing[@]} -gt 0 ]]; then
    log "ERROR: Missing required environment variables: ${missing[*]}"
    notify "error" "Backup Failed" "Missing environment variables: ${missing[*]}"
    exit 1
  fi
}

# Create backup
create_backup() {
  log "Creating database backup..."
  mkdir -p "$BACKUP_DIR"

  if ! pg_dump "$DATABASE_URL" --no-owner --no-acl 2>/dev/null | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"; then
    log "ERROR: pg_dump failed"
    notify "error" "Backup Failed" "pg_dump command failed. Check database connection."
    exit 1
  fi

  BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

# Upload to R2
upload_to_r2() {
  log "Uploading to Cloudflare R2..."

  if ! AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
       AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
       aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${BUCKET}/${R2_PATH}" \
         --endpoint-url "$R2_ENDPOINT" \
         --no-progress 2>/dev/null; then
    log "ERROR: Upload to R2 failed"
    notify "error" "Backup Failed" "Failed to upload backup to Cloudflare R2."
    exit 1
  fi

  log "Uploaded to R2: s3://${BUCKET}/${R2_PATH}"
}

# Cleanup old R2 backups
cleanup_old_backups() {
  log "Cleaning up backups older than ${RETENTION_DAYS} days..."

  # Calculate cutoff date (works on both Linux and macOS)
  local cutoff_date
  if date -d "-${RETENTION_DAYS} days" +%Y%m%d &>/dev/null; then
    cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)
  else
    cutoff_date=$(date -v-${RETENTION_DAYS}d +%Y%m%d)
  fi

  local deleted=0

  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 ls "s3://${BUCKET}/db-backups/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | while read -r line; do

    local filename
    filename=$(echo "$line" | awk '{print $4}')
    local file_date
    file_date=$(echo "$filename" | grep -oE '[0-9]{8}' | head -1)

    if [[ -n "$file_date" && "$file_date" < "$cutoff_date" ]]; then
      log "Deleting old backup: $filename"
      AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
      aws s3 rm "s3://${BUCKET}/db-backups/${filename}" \
        --endpoint-url "$R2_ENDPOINT" 2>/dev/null || true
      ((deleted++)) || true
    fi
  done

  log "Cleanup complete"
}

# Count total backups
count_backups() {
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 ls "s3://${BUCKET}/db-backups/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | wc -l | tr -d ' '
}

# Main
main() {
  log "=== Database Backup Started ==="
  local start_time=$SECONDS

  validate_env
  create_backup
  upload_to_r2
  cleanup_old_backups

  local duration=$((SECONDS - start_time))
  local total_backups
  total_backups=$(count_backups)

  log "=== Database Backup Complete (${duration}s) ==="

  # Send success notification
  notify "success" "Backup Complete" "**File:** ${BACKUP_FILE}\\n**Size:** ${BACKUP_SIZE}\\n**Duration:** ${duration}s\\n**Total backups:** ${total_backups}"
}

main "$@"
