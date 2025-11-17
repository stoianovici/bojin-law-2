#!/usr/bin/env bash

# Restore database from Render backup
# Uses Render API to restore from backup

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
  cat <<EOF
Usage: $(basename "$0") [BACKUP_ID] [OPTIONS]

Restore database from a Render backup.

Arguments:
  BACKUP_ID       ID of the backup to restore (required)

Options:
  -h, --help      Show this help message
  -e, --env ENV   Environment (staging|production, default: staging)
  -d, --database  Database name (default: postgres)
  -f, --force     Skip confirmation prompt

Examples:
  $(basename "$0") backup_abc123
  $(basename "$0") backup_abc123 --env production --force
  $(basename "$0") backup_abc123 --database postgres

Environment Variables:
  RENDER_API_KEY    Render API key (required)

Prerequisites:
  - Render CLI must be installed: npm install -g @render/cli
  - Must be logged in: render login

Warning:
  - This operation is DESTRUCTIVE and will replace current database
  - Always backup current state before restoring
  - Use --force to skip confirmation

EOF
  exit 1
}

# Function to log messages
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $*"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $*" >&2
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠ $*"
}

# Check if Render CLI is installed
if ! command -v render &> /dev/null; then
  log_error "Render CLI is not installed"
  log "Install it with: npm install -g @render/cli"
  log "Then login with: render login"
  exit 1
fi

# Parse arguments
BACKUP_ID=""
ENVIRONMENT="staging"
DATABASE="postgres"
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -d|--database)
      DATABASE="$2"
      shift 2
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    *)
      if [[ -z "$BACKUP_ID" ]]; then
        BACKUP_ID="$1"
        shift
      else
        log_error "Unknown option: $1"
        usage
      fi
      ;;
  esac
done

# Validate backup ID
if [[ -z "$BACKUP_ID" ]]; then
  log_error "Backup ID is required"
  usage
fi

# Check API key
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  log_error "RENDER_API_KEY environment variable is not set"
  log "Export it or add to your shell profile"
  exit 1
fi

# Confirmation prompt
if [[ "$FORCE" == false ]]; then
  log_warning "⚠️  WARNING: This will REPLACE the current database in $ENVIRONMENT"
  log_warning "⚠️  Current data will be LOST unless backed up"
  echo -n "Are you sure you want to restore from $BACKUP_ID? (yes/no): "
  read -r CONFIRM

  if [[ "$CONFIRM" != "yes" ]]; then
    log "Restore cancelled by user"
    exit 0
  fi
fi

# Restore from backup
log "Restoring $DATABASE ($ENVIRONMENT) from backup $BACKUP_ID..."

RENDER_CMD="render db restore --database $DATABASE --backup $BACKUP_ID"

log "Command: $RENDER_CMD"

if eval "$RENDER_CMD"; then
  log_success "Restore initiated successfully"
  log "Monitor progress at: https://dashboard.render.com/"
  log_warning "Services may be temporarily unavailable during restore"
else
  log_error "Failed to restore from backup"
  exit 1
fi
