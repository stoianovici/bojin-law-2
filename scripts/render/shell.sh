#!/usr/bin/env bash

# Open shell in a Render service
# Uses Render CLI to open interactive shell

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
Usage: $(basename "$0") [SERVICE_NAME] [OPTIONS]

Open an interactive shell in a Render service.

Arguments:
  SERVICE_NAME    Name of the service (required)
                  Options: web, gateway, document-service, ai-service,
                           task-service, integration-service, notification-service

Options:
  -h, --help      Show this help message
  -e, --env ENV   Environment (staging|production, default: staging)
  -c, --command   Command to run (default: interactive shell)

Examples:
  $(basename "$0") web
  $(basename "$0") gateway --env production
  $(basename "$0") web --command "npm run db:migrate"

Environment Variables:
  RENDER_API_KEY    Render API key (required)

Prerequisites:
  - Render CLI must be installed: npm install -g @render/cli
  - Must be logged in: render login

EOF
  exit 1
}

# Function to log messages
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
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
SERVICE_NAME=""
ENVIRONMENT="staging"
COMMAND=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -c|--command)
      COMMAND="$2"
      shift 2
      ;;
    web|gateway|document-service|ai-service|task-service|integration-service|notification-service)
      SERVICE_NAME="$1"
      shift
      ;;
    *)
      log_error "Unknown option or service: $1"
      usage
      ;;
  esac
done

# Validate service name
if [[ -z "$SERVICE_NAME" ]]; then
  log_error "Service name is required"
  usage
fi

# Check API key
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  log_warning "RENDER_API_KEY not set, using logged-in credentials"
fi

# Build command
if [[ -z "$COMMAND" ]]; then
  log "Opening interactive shell for $SERVICE_NAME ($ENVIRONMENT)..."
  RENDER_CMD="render shell --service $SERVICE_NAME"
else
  log "Running command in $SERVICE_NAME ($ENVIRONMENT): $COMMAND"
  RENDER_CMD="render shell --service $SERVICE_NAME --command \"$COMMAND\""
fi

log "Command: $RENDER_CMD"

# Execute command
eval "$RENDER_CMD"
