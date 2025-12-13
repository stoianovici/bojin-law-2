#!/usr/bin/env bash

# Post-deployment smoke test
# Verifies critical paths are working after deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}[smoke-test]${NC} $*"; }
log_success() { echo -e "${GREEN}[smoke-test]${NC} ✓ $*"; }
log_error() { echo -e "${RED}[smoke-test]${NC} ✗ $*" >&2; }
log_warning() { echo -e "${YELLOW}[smoke-test]${NC} ⚠ $*"; }

# Default URLs (can be overridden with environment variables)
WEB_URL="${SMOKE_TEST_WEB_URL:-https://legal-platform-web.onrender.com}"
GATEWAY_URL="${SMOKE_TEST_GATEWAY_URL:-https://legal-platform-gateway.onrender.com}"
LEGACY_IMPORT_URL="${SMOKE_TEST_LEGACY_IMPORT_URL:-https://legacy-import.onrender.com}"

# Track failures
FAILED=0
PASSED=0

# Test a single endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local timeout="${4:-30}"

  log "Testing: $name"

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

  if [[ "$HTTP_STATUS" == "$expected_status" ]]; then
    log_success "$name (HTTP $HTTP_STATUS)"
    ((PASSED++))
    return 0
  else
    log_error "$name - Expected HTTP $expected_status, got $HTTP_STATUS"
    ((FAILED++))
    return 1
  fi
}

# Test GraphQL endpoint with a simple query
test_graphql() {
  local name="$1"
  local url="$2"

  log "Testing: $name (GraphQL introspection)"

  RESPONSE=$(curl -s --max-time 30 \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' \
    "$url" 2>/dev/null || echo '{"errors":[]}')

  if echo "$RESPONSE" | grep -q '"data"'; then
    log_success "$name - GraphQL responding"
    ((PASSED++))
    return 0
  else
    log_error "$name - GraphQL not responding correctly"
    log_error "Response: $RESPONSE"
    ((FAILED++))
    return 1
  fi
}

# Main smoke tests
run_smoke_tests() {
  log "Starting smoke tests..."
  log "Web URL: $WEB_URL"
  log "Gateway URL: $GATEWAY_URL"
  log ""

  # Web app tests
  log "=== Web Application ==="
  test_endpoint "Web health check" "$WEB_URL/api/health" || true
  test_endpoint "Web homepage" "$WEB_URL" || true
  test_endpoint "Web login page" "$WEB_URL/login" || true

  echo ""

  # Gateway tests
  log "=== Gateway (GraphQL API) ==="
  test_endpoint "Gateway health check" "$GATEWAY_URL/health" || true
  test_graphql "Gateway GraphQL" "$GATEWAY_URL/graphql" || true

  echo ""

  # Legacy import (optional - may not be deployed)
  log "=== Legacy Import (optional) ==="
  test_endpoint "Legacy import health" "$LEGACY_IMPORT_URL/api/health" "200" "10" || log_warning "Legacy import not responding (may not be deployed)"

  echo ""

  # Summary
  log "=== Smoke Test Summary ==="
  log_success "Passed: $PASSED"
  if [[ $FAILED -gt 0 ]]; then
    log_error "Failed: $FAILED"
    log ""
    log_error "Some smoke tests failed. Check the logs above for details."
    return 1
  else
    log_success "All critical smoke tests passed!"
    return 0
  fi
}

# Parse arguments
case "${1:-}" in
  -h|--help)
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Run post-deployment smoke tests to verify critical paths.

Options:
  -h, --help    Show this help message
  --staging     Test staging environment
  --production  Test production environment (default)

Environment Variables:
  SMOKE_TEST_WEB_URL        Override web app URL
  SMOKE_TEST_GATEWAY_URL    Override gateway URL
  SMOKE_TEST_LEGACY_IMPORT_URL  Override legacy import URL

Examples:
  $(basename "$0")                    # Test production
  $(basename "$0") --staging          # Test staging
  SMOKE_TEST_WEB_URL=http://localhost:3000 $(basename "$0")  # Test local
EOF
    exit 0
    ;;
  --staging)
    WEB_URL="https://staging-legal-platform-web.onrender.com"
    GATEWAY_URL="https://staging-legal-platform-gateway.onrender.com"
    LEGACY_IMPORT_URL="https://staging-legacy-import.onrender.com"
    ;;
  --production|"")
    # Use defaults
    ;;
  *)
    log_error "Unknown option: $1"
    exit 1
    ;;
esac

run_smoke_tests
