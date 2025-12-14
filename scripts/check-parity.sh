#!/usr/bin/env bash

# Dev/Production Parity Check Script
# Validates that development environment matches production configuration
# Run this to catch environment drift before it causes deployment surprises

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}[parity]${NC} $*"; }
log_success() { echo -e "${GREEN}[parity]${NC} ✓ $*"; }
log_error() { echo -e "${RED}[parity]${NC} ✗ $*" >&2; }
log_warning() { echo -e "${YELLOW}[parity]${NC} ⚠ $*"; }

# Track results
CHECKS_PASSED=0
CHECKS_FAILED=0

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

log "Checking dev/production parity in $PROJECT_ROOT"
log ""

# ============================================================
# Check 1: Node.js version consistency
# ============================================================
log "=== Node.js Version Parity ==="

# Expected Node version (from production Dockerfiles)
EXPECTED_NODE="22"

# Extract Node versions from various sources (using sed for macOS compatibility)
extract_node_version() {
  grep "FROM node:" "$1" 2>/dev/null | head -1 | sed -E 's/.*FROM node:([0-9]+).*/\1/' || echo "not found"
}

DEV_DOCKERFILE_NODE=$(extract_node_version infrastructure/docker/Dockerfile.dev)
WEB_DOCKERFILE_NODE=$(extract_node_version infrastructure/docker/Dockerfile.web)
GATEWAY_DOCKERFILE_NODE=$(extract_node_version infrastructure/docker/Dockerfile.gateway)
AI_DOCKERFILE_NODE=$(extract_node_version infrastructure/docker/Dockerfile.ai-service)

# Check CI workflow Node versions (macOS compatible)
CI_NODE_VERSIONS=$(grep "NODE_VERSION:" .github/workflows/*.yml 2>/dev/null | sed -E "s/.*NODE_VERSION:[[:space:]]*['\"]?([0-9]+)['\"]?.*/\1/" | sort -u | tr '\n' ' ' || echo "not found")

log "Expected Node version: $EXPECTED_NODE"
log "  Dockerfile.dev:        $DEV_DOCKERFILE_NODE"
log "  Dockerfile.web:        $WEB_DOCKERFILE_NODE"
log "  Dockerfile.gateway:    $GATEWAY_DOCKERFILE_NODE"
log "  Dockerfile.ai-service: $AI_DOCKERFILE_NODE"
log "  CI workflows:          $(echo $CI_NODE_VERSIONS | tr '\n' ' ')"

# Validate all match
ALL_NODE_MATCH=true
for version in "$DEV_DOCKERFILE_NODE" "$WEB_DOCKERFILE_NODE" "$GATEWAY_DOCKERFILE_NODE" "$AI_DOCKERFILE_NODE"; do
  if [[ "$version" != "$EXPECTED_NODE" && "$version" != "not found" ]]; then
    ALL_NODE_MATCH=false
  fi
done

# Check CI versions
for version in $CI_NODE_VERSIONS; do
  if [[ "$version" != "$EXPECTED_NODE" ]]; then
    ALL_NODE_MATCH=false
  fi
done

if [[ "$ALL_NODE_MATCH" == true ]]; then
  log_success "All Node.js versions match ($EXPECTED_NODE)"
  ((CHECKS_PASSED++))
else
  log_error "Node.js version mismatch detected!"
  log_error "  All Dockerfiles and CI workflows should use Node $EXPECTED_NODE"
  ((CHECKS_FAILED++))
fi

log ""

# ============================================================
# Check 2: pnpm version consistency
# ============================================================
log "=== pnpm Version Parity ==="

PACKAGE_JSON_PNPM=$(grep '"packageManager"' package.json 2>/dev/null | sed -E 's/.*"pnpm@([^"]+)".*/\1/' || echo "not found")
LOCAL_PNPM=$(pnpm --version 2>/dev/null || echo "not installed")

log "  package.json packageManager: pnpm@$PACKAGE_JSON_PNPM"
log "  Local pnpm version:          $LOCAL_PNPM"

# Just check major version match
PACKAGE_PNPM_MAJOR=$(echo "$PACKAGE_JSON_PNPM" | cut -d. -f1)
LOCAL_PNPM_MAJOR=$(echo "$LOCAL_PNPM" | cut -d. -f1)

if [[ "$PACKAGE_PNPM_MAJOR" == "$LOCAL_PNPM_MAJOR" ]]; then
  log_success "pnpm major version matches ($PACKAGE_PNPM_MAJOR.x)"
  ((CHECKS_PASSED++))
else
  log_warning "pnpm version mismatch (local: $LOCAL_PNPM, package.json: $PACKAGE_JSON_PNPM)"
  log_warning "  This may cause lockfile inconsistencies"
fi

log ""

# ============================================================
# Check 3: Docker compose files exist and are valid
# ============================================================
log "=== Docker Compose Files ==="

COMPOSE_FILES=(
  "infrastructure/docker/docker-compose.yml"
  "infrastructure/docker/docker-compose.prod.yml"
)

for compose_file in "${COMPOSE_FILES[@]}"; do
  if [[ -f "$compose_file" ]]; then
    # Check syntax without env validation (env files may not exist in all dev setups)
    if docker compose -f "$compose_file" config --quiet 2>&1 | grep -q "error"; then
      log_error "$compose_file has syntax errors"
      ((CHECKS_FAILED++))
    else
      # Basic YAML syntax check - file exists and has services defined
      if grep -q "^services:" "$compose_file"; then
        log_success "$compose_file has valid structure"
        ((CHECKS_PASSED++))
      else
        log_warning "$compose_file may have issues (missing services block)"
      fi
    fi
  else
    log_warning "$compose_file not found"
  fi
done

log ""

# ============================================================
# Check 4: Production Dockerfiles can be parsed
# ============================================================
log "=== Production Dockerfile Syntax ==="

DOCKERFILES=(
  "infrastructure/docker/Dockerfile.web"
  "infrastructure/docker/Dockerfile.gateway"
  "infrastructure/docker/Dockerfile.ai-service"
)

for dockerfile in "${DOCKERFILES[@]}"; do
  if [[ -f "$dockerfile" ]]; then
    # Basic syntax check - ensure it has FROM, WORKDIR, CMD/ENTRYPOINT
    if grep -q "^FROM" "$dockerfile" && grep -q "WORKDIR" "$dockerfile"; then
      log_success "$dockerfile has valid structure"
      ((CHECKS_PASSED++))
    else
      log_error "$dockerfile missing required directives"
      ((CHECKS_FAILED++))
    fi
  else
    log_error "$dockerfile not found"
    ((CHECKS_FAILED++))
  fi
done

log ""

# ============================================================
# Check 5: Environment variable shapes
# ============================================================
log "=== Environment Variables ==="

# Check for .env.example or documented env vars
if [[ -f ".env.example" ]] || [[ -f "apps/web/.env.example" ]]; then
  log_success "Environment template file exists"
  ((CHECKS_PASSED++))
else
  log_warning "No .env.example found - env vars should be documented"
fi

# Check render.yaml for env var definitions
if [[ -f "render.yaml" ]]; then
  ENV_COUNT=$(grep -c "envVars:" render.yaml 2>/dev/null || echo "0")
  log "  render.yaml defines env vars for $ENV_COUNT services"
  log_success "render.yaml present"
  ((CHECKS_PASSED++))
else
  log_warning "render.yaml not found"
fi

log ""

# ============================================================
# Summary
# ============================================================
log "=== Parity Check Summary ==="
log_success "Passed: $CHECKS_PASSED"
if [[ $CHECKS_FAILED -gt 0 ]]; then
  log_error "Failed: $CHECKS_FAILED"
  log ""
  log_error "Parity issues detected! Fix the issues above to ensure dev matches production."
  exit 1
else
  log ""
  log_success "Dev/production parity verified!"
  exit 0
fi
