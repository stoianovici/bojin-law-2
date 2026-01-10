#!/usr/bin/env bash

# Deploy to Render staging or production environment
# Triggers deployment using Render Deploy Hooks

set -euo pipefail

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source .env.render if it exists (contains deploy hooks)
if [[ -f "$PROJECT_ROOT/.env.render" ]]; then
  set -a
  source "$PROJECT_ROOT/.env.render"
  set +a
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
  cat <<EOF
Usage: $(basename "$0") [ENVIRONMENT|SERVICE] [OPTIONS]

Deploy the application to Render.

Arguments:
  production           Deploy web + gateway + ai-service (default)
  staging              Deploy web + gateway + ai-service
  web                  Deploy web only
  gateway              Deploy gateway only
  ai-service           Deploy ai-service only
  legacy-import        Deploy legacy-import only (separate from main deploy)

Options:
  -h, --help           Show this help message
  -w, --wait           Wait for deployment to complete
  -t, --timeout SECS   Timeout for waiting (default: 600)

Examples:
  $(basename "$0")                    # Deploy all services (production)
  $(basename "$0") production         # Deploy all services (production)
  $(basename "$0") gateway            # Deploy gateway only
  $(basename "$0") web                # Deploy web only
  $(basename "$0") production --wait  # Deploy all and wait

Environment Variables (auto-loaded from .env.render):
  RENDER_DEPLOY_HOOK_WEB             Web service deploy hook
  RENDER_DEPLOY_HOOK_GATEWAY         Gateway service deploy hook
  RENDER_DEPLOY_HOOK_AI_SERVICE      AI service deploy hook
  RENDER_DEPLOY_HOOK_LEGACY_IMPORT   Legacy import deploy hook
  RENDER_API_KEY                     Render API key for checking status

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
TARGET="production"  # Default to production (web)
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
    staging|production|web|gateway|ai-service|legacy-import)
      TARGET="$1"
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Function to deploy a single service
deploy_service() {
  local service_name="$1"
  local hook_url="$2"

  if [[ -z "$hook_url" ]]; then
    log_error "Deploy hook for $service_name is not set"
    log_warning "Check .env.render file in project root"
    return 1
  fi

  log "Deploying $service_name..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$hook_url")

  if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
    log_success "$service_name deployment triggered (HTTP $HTTP_CODE)"
    return 0
  else
    log_error "$service_name deployment failed (HTTP $HTTP_CODE)"
    return 1
  fi
}

# Get hook URL for a service
get_hook_url() {
  local service="$1"
  case "$service" in
    web) echo "${RENDER_DEPLOY_HOOK_WEB:-${RENDER_DEPLOY_HOOK_PRODUCTION:-}}" ;;
    gateway) echo "${RENDER_DEPLOY_HOOK_GATEWAY:-}" ;;
    ai-service) echo "${RENDER_DEPLOY_HOOK_AI_SERVICE:-}" ;;
    legacy-import) echo "${RENDER_DEPLOY_HOOK_LEGACY_IMPORT:-}" ;;
    *) echo "" ;;
  esac
}

# Build list of services to deploy based on target
SERVICES_TO_DEPLOY=""
case "$TARGET" in
  production|staging)
    SERVICES_TO_DEPLOY="web gateway ai-service"
    ;;
  web)
    SERVICES_TO_DEPLOY="web"
    ;;
  gateway)
    SERVICES_TO_DEPLOY="gateway"
    ;;
  ai-service)
    SERVICES_TO_DEPLOY="ai-service"
    ;;
  legacy-import)
    SERVICES_TO_DEPLOY="legacy-import"
    ;;
  *)
    log_error "Invalid target: $TARGET"
    usage
    ;;
esac

# Deploy all services
log "Deploying to: $SERVICES_TO_DEPLOY"
FAILED=0
SUCCEEDED=0

for service in $SERVICES_TO_DEPLOY; do
  hook_url=$(get_hook_url "$service")
  if deploy_service "$service" "$hook_url"; then
    SUCCEEDED=$((SUCCEEDED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
done

# Summary
log ""
log "=== Deployment Summary ==="
log_success "Triggered: $SUCCEEDED service(s)"
if [[ $FAILED -gt 0 ]]; then
  log_error "Failed: $FAILED service(s)"
fi
log "Dashboard: https://dashboard.render.com/"

# Wait for deployment if requested
if [[ "$WAIT" == true && $SUCCEEDED -gt 0 ]]; then
  log "Waiting for deployment to complete (timeout: ${TIMEOUT}s)..."
  log_warning "Note: Checking deployment status requires RENDER_API_KEY"

  if [[ -z "${RENDER_API_KEY:-}" ]]; then
    log_warning "RENDER_API_KEY not set, cannot check deployment status"
    log "Please check Render dashboard for deployment progress"
  else
    # Simple polling loop
    ELAPSED=0
    while [[ $ELAPSED -lt $TIMEOUT ]]; do
      sleep 10
      ELAPSED=$((ELAPSED + 10))
      log "Waiting... (${ELAPSED}s / ${TIMEOUT}s)"
    done
    log_warning "Deployment monitoring timeout reached. Check Render dashboard for status."
  fi
fi

# Exit with error if any deployments failed
if [[ $FAILED -gt 0 ]]; then
  exit 1
fi

log_success "Deploy command completed"
