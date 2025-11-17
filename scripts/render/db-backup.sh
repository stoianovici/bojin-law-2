#!/usr/bin/env bash

# Trigger manual database backup on Render
# Uses Render API to create backup

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
Usage: $(basename "$0") [OPTIONS]

Trigger a manual database backup on Render.

Options:
  -h, --help      Show this help message
  -e, --env ENV   Environment (staging|production, default: staging)
  -d, --database  Database name (default: postgres)

Examples:
  $(basename "$0")
  $(basename "$0") --env production
  $(basename "$0") --database postgres --env production

Environment Variables:
  RENDER_API_KEY    Render API key (required)

Prerequisites:
  - Render CLI must be installed: npm install -g @render/cli
  - Must be logged in: render login

Notes:
  - Render automatically backs up databases daily
  - Manual backups are retained for 7 days (Standard plan)
  - Use this for pre-deployment backups or critical moments

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
ENVIRONMENT="staging"
DATABASE="postgres"

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
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Check API key
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  log_error "RENDER_API_KEY environment variable is not set"
  log "Export it or add to your shell profile"
  exit 1
fi

# Trigger backup
log "Triggering manual backup for $DATABASE ($ENVIRONMENT)..."

RENDER_CMD="render db backup --database $DATABASE"

log "Command: $RENDER_CMD"

if eval "$RENDER_CMD"; then
  log_success "Backup triggered successfully"
  log "View backups at: https://dashboard.render.com/"
  log_warning "Manual backups are retained for 7 days"
else
  log_error "Failed to trigger backup"
  exit 1
fi
