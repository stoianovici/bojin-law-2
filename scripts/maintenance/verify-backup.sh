#!/usr/bin/env bash

# Backup Verification Script
# Downloads latest backup from R2, restores to temp database, validates, then cleans up
#
# Required Environment Variables:
#   DATABASE_URL - PostgreSQL connection string (to get connection params)
#   R2_ACCESS_KEY_ID - Cloudflare R2 access key
#   R2_SECRET_ACCESS_KEY - Cloudflare R2 secret key
#   R2_ENDPOINT - R2 endpoint URL
#   R2_BUCKET_NAME - R2 bucket (default: legal-platform-backups)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
TEMP_DIR="/tmp/backup-verify"
TEMP_DB="legal_platform_verify_$(date +%s)"
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
  log "Cleaning up..."

  # Drop temp database if it exists
  if [[ -n "${PGHOST:-}" ]]; then
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
      -c "DROP DATABASE IF EXISTS ${TEMP_DB};" 2>/dev/null || true
  fi

  # Remove temp files
  rm -rf "$TEMP_DIR" 2>/dev/null || true
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
    notify "error" "Backup Verification Failed" "Missing environment variables: ${missing[*]}"
    exit 1
  fi
}

# Parse DATABASE_URL to get connection params
parse_db_url() {
  # postgresql://user:pass@host:port/database
  local url="$DATABASE_URL"

  # Remove postgresql:// prefix
  url="${url#postgresql://}"

  # Extract user:pass
  local userpass="${url%%@*}"
  PGUSER="${userpass%%:*}"
  PGPASSWORD="${userpass#*:}"

  # Extract host:port/database
  local rest="${url#*@}"
  local hostport="${rest%%/*}"
  PGHOST="${hostport%%:*}"
  PGPORT="${hostport#*:}"

  # Export for psql
  export PGUSER PGPASSWORD PGHOST PGPORT
}

# Get latest backup filename from R2
get_latest_backup() {
  log "Finding latest backup in R2..." >&2

  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 ls "s3://${BUCKET}/db-backups/" \
    --endpoint-url "$R2_ENDPOINT" 2>/dev/null | \
    sort -k1,2 | tail -1 | awk '{print $4}'
}

# Download backup from R2
download_backup() {
  local filename="$1"
  log "Downloading backup: $filename"

  mkdir -p "$TEMP_DIR"

  if ! AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
       AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
       aws s3 cp "s3://${BUCKET}/db-backups/${filename}" "${TEMP_DIR}/${filename}" \
         --endpoint-url "$R2_ENDPOINT" \
         --no-progress 2>/dev/null; then
    log "ERROR: Failed to download backup"
    notify "error" "Backup Verification Failed" "Failed to download backup from R2."
    exit 1
  fi

  BACKUP_FILE="${TEMP_DIR}/${filename}"
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Downloaded: $filename ($BACKUP_SIZE)"
}

# Create temp database and restore
restore_backup() {
  log "Creating temp database: $TEMP_DB"

  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres \
    -c "CREATE DATABASE ${TEMP_DB};" 2>/dev/null

  log "Restoring backup..."

  if ! gunzip -c "$BACKUP_FILE" | psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB" 2>/dev/null; then
    log "ERROR: Restore failed"
    notify "error" "Backup Verification Failed" "Failed to restore backup to temp database."
    exit 1
  fi

  log "Restore complete"
}

# Validate restored data
validate_data() {
  log "Validating restored data..."

  local table_count user_count case_count

  # Count tables
  table_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB" -t -c "
    SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
  " 2>/dev/null | tr -d ' ')

  if [[ "$table_count" -lt 10 ]]; then
    log "ERROR: Too few tables ($table_count) - backup may be corrupted"
    notify "error" "Backup Verification Failed" "Restored backup has only $table_count tables - expected more."
    exit 1
  fi

  # Count users (should have at least 1)
  user_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB" -t -c "
    SELECT count(*) FROM users;
  " 2>/dev/null | tr -d ' ' || echo "0")

  # Count cases
  case_count=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$TEMP_DB" -t -c "
    SELECT count(*) FROM cases;
  " 2>/dev/null | tr -d ' ' || echo "0")

  log "Validation passed: $table_count tables, $user_count users, $case_count cases"

  # Store for notification
  TABLE_COUNT="$table_count"
  USER_COUNT="$user_count"
  CASE_COUNT="$case_count"
}

# Main
main() {
  log "=== Backup Verification Started ==="
  local start_time=$SECONDS

  validate_env
  parse_db_url

  local latest_backup
  latest_backup=$(get_latest_backup)

  if [[ -z "$latest_backup" ]]; then
    log "ERROR: No backups found in R2"
    notify "error" "Backup Verification Failed" "No backups found in R2 bucket."
    exit 1
  fi

  download_backup "$latest_backup"
  restore_backup
  validate_data

  local duration=$((SECONDS - start_time))
  log "=== Backup Verification Complete (${duration}s) ==="

  # Send success notification
  notify "success" "Backup Verification Passed" "**Backup:** ${latest_backup}\\n**Size:** ${BACKUP_SIZE}\\n**Tables:** ${TABLE_COUNT}\\n**Users:** ${USER_COUNT}\\n**Cases:** ${CASE_COUNT}\\n**Duration:** ${duration}s"
}

main "$@"
