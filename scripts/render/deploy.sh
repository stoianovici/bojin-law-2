#!/usr/bin/env bash

# Deploy to Render staging or production environment
# Triggers deployment using Render Deploy Hooks

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
Usage: $(basename "$0") [staging|production] [OPTIONS]

Deploy the application to Render environment.

Arguments:
  staging|production    Target environment (required)

Options:
  -h, --help           Show this help message
  -w, --wait           Wait for deployment to complete
  -t, --timeout SECS   Timeout for waiting (default: 600)

Examples:
  $(basename "$0") staging
  $(basename "$0") production --wait
  $(basename "$0") staging --wait --timeout 900

Environment Variables:
  RENDER_DEPLOY_HOOK_STAGING       Render deploy hook URL for staging
  RENDER_DEPLOY_HOOK_PRODUCTION    Render deploy hook URL for production
  RENDER_API_KEY                   Render API key for checking status

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

# Parse arguments
ENVIRONMENT=""
WAIT=false
TIMEOUT=600

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    -w|--wait)
      WAIT=true
      shift
      ;;
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    staging|production)
      ENVIRONMENT="$1"
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
  log_error "Environment is required (staging or production)"
  usage
fi

# Get deploy hook URL
if [[ "$ENVIRONMENT" == "staging" ]]; then
  DEPLOY_HOOK="${RENDER_DEPLOY_HOOK_STAGING:-}"
  if [[ -z "$DEPLOY_HOOK" ]]; then
    log_error "RENDER_DEPLOY_HOOK_STAGING environment variable is not set"
    log_warning "Set it in GitHub secrets or export it locally"
    exit 1
  fi
elif [[ "$ENVIRONMENT" == "production" ]]; then
  DEPLOY_HOOK="${RENDER_DEPLOY_HOOK_PRODUCTION:-}"
  if [[ -z "$DEPLOY_HOOK" ]]; then
    log_error "RENDER_DEPLOY_HOOK_PRODUCTION environment variable is not set"
    log_warning "Set it in GitHub secrets or export it locally"
    exit 1
  fi
else
  log_error "Invalid environment: $ENVIRONMENT (must be 'staging' or 'production')"
  exit 1
fi

# Trigger deployment
log "Triggering deployment to $ENVIRONMENT..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$DEPLOY_HOOK")

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  log_success "Deployment triggered successfully (HTTP $HTTP_CODE)"
  log "Deployment URL: https://dashboard.render.com/"

  if [[ "$WAIT" == true ]]; then
    log "Waiting for deployment to complete (timeout: ${TIMEOUT}s)..."
    log_warning "Note: Checking deployment status requires RENDER_API_KEY"

    if [[ -z "${RENDER_API_KEY:-}" ]]; then
      log_error "RENDER_API_KEY not set, cannot check deployment status"
      exit 1
    fi

    # Simple polling loop (production version would use Render API)
    ELAPSED=0
    while [[ $ELAPSED -lt $TIMEOUT ]]; do
      sleep 10
      ELAPSED=$((ELAPSED + 10))
      log "Checking deployment status... (${ELAPSED}s / ${TIMEOUT}s)"

      # TODO: Implement actual Render API status check
      # For now, just wait for timeout or user can check dashboard
    done

    log_warning "Deployment monitoring timeout reached. Check Render dashboard for status."
  fi
else
  log_error "Deployment failed (HTTP $HTTP_CODE)"
  log_error "Check deploy hook URL and try again"
  exit 1
fi

log_success "Deploy command completed"
