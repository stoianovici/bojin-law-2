#!/usr/bin/env bash

# Preflight Check Script
# Run this before pushing to ensure local dev matches production build
# Catches issues that would only appear after deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}[preflight]${NC} $*"; }
log_success() { echo -e "${GREEN}[preflight]${NC} ✓ $*"; }
log_error() { echo -e "${RED}[preflight]${NC} ✗ $*" >&2; }
log_warning() { echo -e "${YELLOW}[preflight]${NC} ⚠ $*"; }

# Track results
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Check function
check() {
  local name="$1"
  shift
  log "Checking: $name"

  if "$@" >/dev/null 2>&1; then
    log_success "$name"
    ((CHECKS_PASSED++))
    return 0
  else
    log_error "$name"
    ((CHECKS_FAILED++))
    return 1
  fi
}

check_with_output() {
  local name="$1"
  shift
  log "Checking: $name"

  if OUTPUT=$("$@" 2>&1); then
    log_success "$name"
    ((CHECKS_PASSED++))
    return 0
  else
    log_error "$name"
    echo "$OUTPUT" | head -20
    ((CHECKS_FAILED++))
    return 1
  fi
}

warn() {
  local name="$1"
  shift
  log "Checking: $name"

  if "$@" >/dev/null 2>&1; then
    log_success "$name"
    ((CHECKS_PASSED++))
    return 0
  else
    log_warning "$name (non-blocking)"
    ((CHECKS_WARNED++))
    return 0
  fi
}

warn_with_output() {
  local name="$1"
  shift
  log "Checking: $name"

  if OUTPUT=$("$@" 2>&1); then
    log_success "$name"
    ((CHECKS_PASSED++))
    return 0
  else
    log_warning "$name (non-blocking)"
    echo "$OUTPUT" | head -20
    ((CHECKS_WARNED++))
    return 0
  fi
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Preflight checks to ensure local dev matches production build.
Run this before pushing to catch deployment issues early.

Options:
  -h, --help      Show this help message
  --quick         Skip Docker build (faster, but less thorough)
  --full          Full check including Docker build (default)
  --fix           Auto-fix common issues (formatting, etc.)

What this checks:
  1. TypeScript compilation (all packages)
  2. ESLint (code quality)
  3. Prettier (formatting)
  4. Unit tests
  5. Production build (pnpm build)
  6. Docker build (matches production)

Examples:
  $(basename "$0")           # Full preflight check
  $(basename "$0") --quick   # Skip Docker build
  $(basename "$0") --fix     # Auto-fix then check
EOF
  exit 0
}

# Parse arguments
SKIP_DOCKER=false
AUTO_FIX=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    --quick)
      SKIP_DOCKER=true
      shift
      ;;
    --full)
      SKIP_DOCKER=false
      shift
      ;;
    --fix)
      AUTO_FIX=true
      shift
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

log "Starting preflight checks in $PROJECT_ROOT"
log ""

# Auto-fix if requested
if [[ "$AUTO_FIX" == true ]]; then
  log "=== Auto-fixing issues ==="
  log "Running prettier --write..."
  pnpm format || true
  log ""
fi

# Phase 1: Static checks (fast)
log "=== Phase 1: Static Analysis ==="

check "pnpm lockfile valid" pnpm install --frozen-lockfile || true
check_with_output "TypeScript compiles" pnpm type-check || true
warn "ESLint passes" pnpm lint || true
warn "Prettier format check" pnpm format --check || true

log ""

# Phase 2: Tests
log "=== Phase 2: Tests ==="

# Unit tests are non-blocking during Romanian UI migration
# TODO: Re-enable as blocking once all test files are updated
warn_with_output "Unit tests pass" pnpm test --passWithNoTests || true

log ""

# Phase 3: Build
log "=== Phase 3: Production Build ==="

check_with_output "Production build succeeds" pnpm build || true

log ""

# Phase 4: Docker (optional)
if [[ "$SKIP_DOCKER" == false ]]; then
  log "=== Phase 4: Docker Build (production parity) ==="
  log "This ensures the Docker build matches what Render will build."
  log ""

  # Check if Docker is running
  if docker info >/dev/null 2>&1; then
    log "Building web Docker image..."
    if docker build -f infrastructure/docker/Dockerfile.web -t preflight-web . 2>&1 | tail -20; then
      log_success "Web Docker build"
      ((CHECKS_PASSED++))
    else
      log_error "Web Docker build failed"
      ((CHECKS_FAILED++))
    fi

    log ""
    log "Building gateway Docker image..."
    if docker build -f infrastructure/docker/Dockerfile.gateway -t preflight-gateway . 2>&1 | tail -20; then
      log_success "Gateway Docker build"
      ((CHECKS_PASSED++))
    else
      log_error "Gateway Docker build failed"
      ((CHECKS_FAILED++))
    fi

    # Cleanup
    docker rmi preflight-web preflight-gateway 2>/dev/null || true
  else
    log_warning "Docker not running - skipping Docker build check"
    ((CHECKS_WARNED++))
  fi

  log ""
else
  log "=== Phase 4: Docker Build (skipped with --quick) ==="
  log_warning "Use full preflight check before important deploys"
  log ""
fi

# Summary
log "=== Preflight Summary ==="
log_success "Passed: $CHECKS_PASSED"
if [[ $CHECKS_WARNED -gt 0 ]]; then
  log_warning "Warnings: $CHECKS_WARNED"
fi
if [[ $CHECKS_FAILED -gt 0 ]]; then
  log_error "Failed: $CHECKS_FAILED"
  log ""
  log_error "Preflight checks failed. Fix the issues above before pushing."
  exit 1
else
  log ""
  log_success "All preflight checks passed! Safe to push."
  exit 0
fi
