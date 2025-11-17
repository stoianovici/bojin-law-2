#!/usr/bin/env bash

# Sync environment variables to Render from .env file
# Uses Render CLI to set environment variables

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
Usage: $(basename "$0") [ENV_FILE] [OPTIONS]

Sync environment variables from a file to Render service.

Arguments:
  ENV_FILE        Path to .env file (default: .env)

Options:
  -h, --help         Show this help message
  -e, --env ENV      Environment (staging|production, default: staging)
  -s, --service SVC  Service to update (default: all services)
  -d, --dry-run      Show what would be synced without applying

Examples:
  $(basename "$0")
  $(basename "$0") .env.production --env production
  $(basename "$0") .env --service web --dry-run

Environment Variables:
  RENDER_API_KEY    Render API key (required)

Prerequisites:
  - Render CLI must be installed: npm install -g @render/cli
  - Must be logged in: render login

Warning:
  - This will overwrite existing environment variables
  - Does not delete variables not in the file
  - Verify with --dry-run before applying

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
ENV_FILE=".env"
ENVIRONMENT="staging"
SERVICE="all"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -s|--service)
      SERVICE="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      if [[ -f "$1" ]]; then
        ENV_FILE="$1"
        shift
      else
        log_error "Unknown option or file not found: $1"
        usage
      fi
      ;;
  esac
done

# Check if env file exists
if [[ ! -f "$ENV_FILE" ]]; then
  log_error "Environment file not found: $ENV_FILE"
  exit 1
fi

# Check API key
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  log_error "RENDER_API_KEY environment variable is not set"
  log "Export it or add to your shell profile"
  exit 1
fi

# Parse env file
log "Reading environment variables from $ENV_FILE..."

# Count variables (exclude comments and empty lines)
VAR_COUNT=$(grep -v "^#" "$ENV_FILE" | grep -v "^$" | wc -l | tr -d ' ')

log "Found $VAR_COUNT environment variables to sync"

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
  log_warning "DRY RUN MODE - No changes will be applied"
  echo ""
  echo "Environment variables to be synced:"
  echo "-----------------------------------"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
      continue
    fi

    # Extract key (before =)
    KEY=$(echo "$line" | cut -d= -f1)
    echo "  - $KEY"
  done < "$ENV_FILE"
  echo ""
  log "Run without --dry-run to apply changes"
  exit 0
fi

# Sync variables
log "Syncing environment variables to $ENVIRONMENT..."

SERVICES=("web" "gateway" "document-service" "ai-service" "task-service" "integration-service" "notification-service")

if [[ "$SERVICE" != "all" ]]; then
  SERVICES=("$SERVICE")
fi

for SVC in "${SERVICES[@]}"; do
  log "Updating service: $SVC"

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ "$line" =~ ^#.*$ ]] || [[ -z "$line" ]]; then
      continue
    fi

    # Extract key and value
    KEY=$(echo "$line" | cut -d= -f1)
    VALUE=$(echo "$line" | cut -d= -f2-)

    # Use Render CLI to set environment variable
    if render env set "$KEY=$VALUE" --service "$SVC" &> /dev/null; then
      echo "  ✓ $KEY"
    else
      log_warning "Failed to set $KEY for $SVC"
    fi
  done < "$ENV_FILE"

  log_success "Service $SVC updated"
done

log_success "Environment variables synced successfully"
log_warning "Note: Services may need to be redeployed for changes to take effect"
