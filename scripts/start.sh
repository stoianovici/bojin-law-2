#!/usr/bin/env bash

# Start local development environment
# Usage: ./scripts/start.sh [--tunnel] [--staging] [--skip-sync]
#
# Options:
#   --tunnel     Start Cloudflare tunnel (dev.bojin-law.com → localhost:4000)
#   --staging    Use staging environment (prod-like behavior via tunnel)
#   --skip-sync  Skip pulling fresh production data (faster startup)
#
# Examples:
#   pnpm start              # Regular local dev (localhost)
#   pnpm start:tunnel       # Local dev with tunnel + fresh prod data
#   pnpm start:staging      # Staging mode with tunnel (prod-like cookies/HTTPS)

set -euo pipefail

# Increase file descriptor limit (fixes Watchpack "too many open files" warnings)
ulimit -n 65536 2>/dev/null || true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse arguments
USE_TUNNEL=false
USE_STAGING=false
SKIP_SYNC=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --tunnel)
      USE_TUNNEL=true
      shift
      ;;
    --staging)
      USE_STAGING=true
      USE_TUNNEL=true  # Staging implies tunnel
      shift
      ;;
    --skip-sync)
      SKIP_SYNC=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--tunnel] [--staging] [--skip-sync]"
      echo ""
      echo "Options:"
      echo "  --tunnel     Start Cloudflare tunnel (dev.bojin-law.com)"
      echo "  --staging    Use staging env with tunnel (prod-like behavior)"
      echo "  --skip-sync  Skip pulling fresh production data"
      echo ""
      echo "Examples:"
      echo "  pnpm start                    # Regular local dev"
      echo "  pnpm start:tunnel             # Tunnel + fresh prod data"
      echo "  pnpm start:tunnel --skip-sync # Tunnel without data sync"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Helper functions
log() { echo -e "${BLUE}[start]${NC} $*"; }
success() { echo -e "${GREEN}[start]${NC} $*"; }
warn() { echo -e "${YELLOW}[start]${NC} $*"; }
error() { echo -e "${RED}[start]${NC} $*" >&2; }

cleanup() {
  log "Shutting down..."
  # Kill background processes
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
log "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
  error "Docker is not installed. Please install Docker Desktop."
  exit 1
fi

if ! docker info &> /dev/null; then
  error "Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Check cloudflared (only if tunnel requested)
if [[ "$USE_TUNNEL" == true ]]; then
  if ! command -v cloudflared &> /dev/null; then
    error "cloudflared is not installed. Run: brew install cloudflared"
    exit 1
  fi

  if [[ ! -f "$HOME/.cloudflared/config.yml" ]]; then
    error "Cloudflare tunnel not configured. Run: cloudflared tunnel login"
    exit 1
  fi
fi

success "Prerequisites OK"

# =============================================================================
# Step 2: Set up environment
# =============================================================================
if [[ "$USE_STAGING" == true ]]; then
  log "Using staging environment (.env.staging)"
  if [[ ! -f ".env.staging" ]]; then
    error ".env.staging not found. Copy from .env.example and configure."
    exit 1
  fi
  cp .env.staging .env.local
  success "Copied .env.staging → .env.local"
elif [[ ! -f ".env.local" ]]; then
  warn ".env.local not found. Copying from .env.example..."
  cp .env.example .env.local
  warn "Please edit .env.local with your Azure AD and Anthropic credentials"
fi

# =============================================================================
# Step 3: Start Docker containers
# =============================================================================
log "Starting Docker containers (PostgreSQL + Redis)..."

if docker compose ps --quiet postgres 2>/dev/null | grep -q .; then
  success "Docker containers already running"
else
  docker compose up -d

  # Wait for PostgreSQL to be ready
  log "Waiting for PostgreSQL..."
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
      success "PostgreSQL ready"
      break
    fi
    sleep 1
  done
fi

# =============================================================================
# Step 4: Sync production data (if using tunnel and not skipped)
# =============================================================================
if [[ "$USE_TUNNEL" == true && "$SKIP_SYNC" == false ]]; then
  log "Syncing production data for full parity..."
  if [[ -f "scripts/mirror-production.sh" ]]; then
    # Run mirror with --confirm to skip interactive prompt
    if ./scripts/mirror-production.sh --confirm; then
      success "Production data synced"
    else
      warn "Data sync failed - continuing with existing data"
    fi
  else
    warn "mirror-production.sh not found - skipping data sync"
  fi
elif [[ "$USE_TUNNEL" == true && "$SKIP_SYNC" == true ]]; then
  log "Skipping production data sync (--skip-sync)"
fi

# =============================================================================
# Step 5: Kill any existing processes on our ports
# =============================================================================
log "Checking ports..."

for port in 3000 3001 3002 4000; do
  if lsof -ti:$port &>/dev/null; then
    warn "Killing existing process on port $port"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
  fi
done

# Clean up Next.js cache (prevents 404 routing issues)
rm -rf apps/web/.next

success "Ports cleared"

# =============================================================================
# Step 6: Start Cloudflare tunnel (if requested)
# =============================================================================
if [[ "$USE_TUNNEL" == true ]]; then
  log "Starting Cloudflare tunnel..."
  cloudflared tunnel run bojin-dev &
  TUNNEL_PID=$!

  # Wait for tunnel to be ready
  sleep 3
  if kill -0 $TUNNEL_PID 2>/dev/null; then
    success "Tunnel running (dev.bojin-law.com → localhost:4000)"
  else
    error "Tunnel failed to start"
    exit 1
  fi
fi

# =============================================================================
# Step 7: Start development servers
# =============================================================================
log "Starting development servers..."
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
if [[ "$USE_TUNNEL" == true ]]; then
  echo -e "${CYAN}  Local Dev Environment (with tunnel)${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${GREEN}Web:${NC}      http://localhost:3000"
  echo -e "  ${GREEN}API:${NC}      http://localhost:4000"
  echo -e "  ${GREEN}Tunnel:${NC}   https://dev.bojin-law.com"
  echo ""
  echo -e "  ${YELLOW}Test tunnel:${NC} curl https://dev.bojin-law.com/health"
else
  echo -e "${CYAN}  Local Dev Environment${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${GREEN}Web:${NC}      http://localhost:3000"
  echo -e "  ${GREEN}API:${NC}      http://localhost:4000/graphql"
  echo -e "  ${GREEN}Health:${NC}   http://localhost:4000/health"
fi
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# Start services
# Note: Web must run from apps/web directory for Next.js route detection to work
# Start web first and wait for it to be ready before starting other services
(cd apps/web && rm -rf .next && pnpm next dev --port 3000) &
WEB_PID=$!

# Wait for web to be ready (poll until 200)
log "Waiting for web server..."
for i in {1..60}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    success "Web server ready"
    break
  fi
  sleep 1
done

# Start other services
pnpm --parallel --filter=@legal-platform/gateway --filter=@legal-platform/ai-service --filter=@legal-platform/database dev &
SERVICES_PID=$!

# Wait for any to exit
wait $WEB_PID $SERVICES_PID
