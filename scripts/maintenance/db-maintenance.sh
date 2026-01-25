#!/usr/bin/env bash

# Database Maintenance Script
# Runs VACUUM ANALYZE and checks table bloat
#
# Required Environment Variables:
#   DATABASE_URL - PostgreSQL connection string

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the notification helper
notify() {
  if [[ -f "${SCRIPT_DIR}/discord-notify.sh" ]]; then
    "${SCRIPT_DIR}/discord-notify.sh" "$@" || true
  fi
}

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Validate environment
if [[ -z "${DATABASE_URL:-}" ]]; then
  log "ERROR: DATABASE_URL not set"
  notify "error" "DB Maintenance Failed" "DATABASE_URL environment variable not set."
  exit 1
fi

# Run VACUUM ANALYZE
run_vacuum() {
  log "Running VACUUM ANALYZE..."

  if ! psql "$DATABASE_URL" -c "VACUUM ANALYZE;" 2>/dev/null; then
    log "ERROR: VACUUM ANALYZE failed"
    notify "error" "DB Maintenance Failed" "VACUUM ANALYZE command failed."
    exit 1
  fi

  log "VACUUM ANALYZE complete"
}

# Get database size
get_db_size() {
  psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null | tr -d ' '
}

# Get table count
get_table_count() {
  psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' '
}

# Check for bloated tables (> 20% dead tuples)
check_bloat() {
  log "Checking for table bloat..."

  local bloated
  bloated=$(psql "$DATABASE_URL" -t -c "
    SELECT schemaname || '.' || relname AS table_name,
           n_dead_tup,
           n_live_tup,
           CASE WHEN n_live_tup > 0
                THEN round(100.0 * n_dead_tup / n_live_tup, 1)
                ELSE 0
           END AS dead_pct
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
      AND n_live_tup > 0
      AND (100.0 * n_dead_tup / n_live_tup) > 20
    ORDER BY n_dead_tup DESC
    LIMIT 5;
  " 2>/dev/null | grep -v '^$' || true)

  if [[ -n "$bloated" ]]; then
    log "WARNING: Found bloated tables"
    echo "$bloated"
    return 1
  else
    log "No significant table bloat detected"
    return 0
  fi
}

# Get connection count
get_connections() {
  psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | tr -d ' '
}

# Main
main() {
  log "=== Database Maintenance Started ==="
  local start_time=$SECONDS

  run_vacuum

  local db_size table_count connections
  db_size=$(get_db_size)
  table_count=$(get_table_count)
  connections=$(get_connections)

  local bloat_warning=""
  if ! check_bloat; then
    bloat_warning="\\n**Warning:** Some tables have high bloat"
  fi

  local duration=$((SECONDS - start_time))
  log "=== Database Maintenance Complete (${duration}s) ==="

  # Send success notification
  notify "success" "DB Maintenance Complete" "**Database size:** ${db_size}\\n**Tables:** ${table_count}\\n**Active connections:** ${connections}\\n**Duration:** ${duration}s${bloat_warning}"
}

main "$@"
