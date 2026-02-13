#!/usr/bin/env bash

# Start local development environment
# Usage: ./scripts/start.sh [--tunnel] [--staging] [--skip-sync] [--local-db]
#
# Options:
#   --tunnel     Start Cloudflare tunnel (dev.bojin-law.com → localhost:4000)
#   --staging    Use staging environment (prod-like behavior via tunnel)
#   --skip-sync  Skip pulling fresh production data (faster startup)
#   --local-db   Use local Docker PostgreSQL instead of Coolify production DB
#
# Database:
#   By default, connects to Coolify production DB via SSH tunnel (port 5433).
#   Use --local-db to use local Docker PostgreSQL instead.
#
# Examples:
#   pnpm start              # Local dev with Coolify DB
#   pnpm start --local-db   # Local dev with Docker PostgreSQL
#   pnpm start:tunnel       # Tunnel + Coolify DB
#   pnpm start:staging      # Staging mode with tunnel (prod-like cookies/HTTPS)

set -euo pipefail

# Increase file descriptor limit (fixes Watchpack "too many open files" warnings)
# macOS default kern.maxfilesperproc is 61440, so use that as ceiling
ulimit -n 61440 2>/dev/null || ulimit -n 10240 2>/dev/null || true

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
USE_LOCAL_DB=false

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
    --local-db)
      USE_LOCAL_DB=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--tunnel] [--staging] [--skip-sync] [--local-db]"
      echo ""
      echo "Options:"
      echo "  --tunnel     Start Cloudflare tunnel (dev.bojin-law.com)"
      echo "  --staging    Use staging env with tunnel (prod-like behavior)"
      echo "  --skip-sync  Skip pulling fresh production data"
      echo "  --local-db   Use local Docker PostgreSQL instead of Coolify DB"
      echo ""
      echo "Examples:"
      echo "  pnpm start                    # Dev with Coolify DB (via SSH tunnel)"
      echo "  pnpm start --local-db         # Dev with local Docker PostgreSQL"
      echo "  pnpm start:tunnel             # Tunnel + Coolify DB"
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
  # Kill SSH tunnel if running
  if lsof -ti:5433 &>/dev/null; then
    log "Closing SSH tunnel..."
    lsof -ti:5433 | xargs kill 2>/dev/null || true
  fi
  # Restore original DATABASE_URL in .env.local if we changed it
  if [[ -n "${ORIGINAL_DATABASE_URL:-}" && -f ".env.local" ]]; then
    log "Restoring original DATABASE_URL in .env.local..."
    sed -i.bak "s|^DATABASE_URL=.*|${ORIGINAL_DATABASE_URL}|" .env.local
    rm -f .env.local.bak
  fi
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
# Step 3: Database Setup (Coolify SSH tunnel or local Docker)
# =============================================================================

# Coolify connection details
COOLIFY_HOST="135.181.44.197"
# Use container IP address (not container name) - resolved via: docker inspect fkwgogssww08484wwokw4wc4
COOLIFY_PG_IP="10.0.1.7"
COOLIFY_PG_USER="legal_platform"
COOLIFY_PG_PASSWORD="HTdJ9oAafB6uiecJlB3FImEop3hNG3LI"
COOLIFY_PG_DATABASE="legal_platform"
SSH_TUNNEL_PORT=5433

if [[ "$USE_LOCAL_DB" == true ]]; then
  # Use local Docker PostgreSQL
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

  # Set DATABASE_URL for local Docker PostgreSQL
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/legal_platform"
  success "DATABASE_URL set for local Docker (localhost:5432)"
else
  # Use Coolify production DB via SSH tunnel
  log "Setting up SSH tunnel to Coolify PostgreSQL..."

  # Check if SSH tunnel already exists on port 5433
  if lsof -ti:$SSH_TUNNEL_PORT &>/dev/null; then
    log "SSH tunnel already running on port $SSH_TUNNEL_PORT"
  else
    # Start SSH tunnel in background (use container IP, not container name)
    ssh -f -N -L ${SSH_TUNNEL_PORT}:${COOLIFY_PG_IP}:5432 root@${COOLIFY_HOST} 2>/dev/null || {
      error "Failed to establish SSH tunnel to Coolify. Make sure you have SSH access to root@${COOLIFY_HOST}"
      error "Try: ssh root@${COOLIFY_HOST}"
      exit 1
    }
    log "SSH tunnel established (localhost:${SSH_TUNNEL_PORT} → Coolify PostgreSQL)"
  fi

  # Wait for tunnel to be ready
  log "Waiting for PostgreSQL connection via tunnel..."
  for i in {1..10}; do
    if pg_isready -h localhost -p $SSH_TUNNEL_PORT -U $COOLIFY_PG_USER &>/dev/null 2>&1 || \
       nc -z localhost $SSH_TUNNEL_PORT &>/dev/null 2>&1; then
      success "Coolify PostgreSQL reachable via tunnel"
      break
    fi
    sleep 1
    if [[ $i -eq 10 ]]; then
      warn "Could not verify PostgreSQL connection, but continuing..."
    fi
  done

  # Update DATABASE_URL in .env.local to point to Coolify via tunnel
  # Add connection pool params for SSH tunnel latency: higher limit and longer timeout
  COOLIFY_DATABASE_URL="postgresql://${COOLIFY_PG_USER}:${COOLIFY_PG_PASSWORD}@localhost:${SSH_TUNNEL_PORT}/${COOLIFY_PG_DATABASE}?connection_limit=30&pool_timeout=30"

  # Backup original DATABASE_URL and update .env.local
  if [[ -f ".env.local" ]]; then
    # Store original for restoration
    ORIGINAL_DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | head -1 || echo "")

    # Update DATABASE_URL in .env.local (replace existing or add)
    if grep -q "^DATABASE_URL=" .env.local; then
      sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=${COOLIFY_DATABASE_URL}|" .env.local
    else
      echo "DATABASE_URL=${COOLIFY_DATABASE_URL}" >> .env.local
    fi
    rm -f .env.local.bak
    success "DATABASE_URL updated in .env.local (Coolify via SSH tunnel on port $SSH_TUNNEL_PORT)"
  fi

  export DATABASE_URL="$COOLIFY_DATABASE_URL"

  # Still start Docker for Redis (local cache)
  log "Starting Docker Redis (local cache)..."
  if docker compose ps --quiet redis 2>/dev/null | grep -q .; then
    success "Redis already running"
  else
    docker compose up -d redis
    sleep 2
  fi
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

for port in 3000 3001 3002 3005 3006 4000; do
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
  echo -e "  ${GREEN}Mobile:${NC}   http://localhost:3002"
  echo -e "  ${GREEN}API:${NC}      http://localhost:4000"
  echo -e "  ${GREEN}Tunnel:${NC}   https://dev.bojin-law.com (API)"
  echo -e "  ${GREEN}Mobile:${NC}   https://m-dev.bojin-law.com"
  if [[ "$USE_LOCAL_DB" == true ]]; then
    echo -e "  ${GREEN}Database:${NC} Docker (localhost:5432)"
  else
    echo -e "  ${GREEN}Database:${NC} Coolify (SSH tunnel :5433)"
  fi
  echo ""
  echo -e "  ${YELLOW}Test API:${NC}    curl https://dev.bojin-law.com/health"
  echo -e "  ${YELLOW}Test Mobile:${NC} Open https://m-dev.bojin-law.com on your phone"
else
  echo -e "${CYAN}  Local Dev Environment${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${GREEN}Web:${NC}        http://localhost:3000"
  echo -e "  ${GREEN}API:${NC}        http://localhost:4000/graphql"
  echo -e "  ${GREEN}Word Add-in:${NC} https://localhost:3005"
  echo -e "  ${GREEN}Health:${NC}     http://localhost:4000/health"
  if [[ "$USE_LOCAL_DB" == true ]]; then
    echo -e "  ${GREEN}Database:${NC}   Docker (localhost:5432)"
  else
    echo -e "  ${GREEN}Database:${NC}   Coolify (SSH tunnel :5433)"
  fi
  echo ""
  echo -e "  ${YELLOW}Word Add-in:${NC} Upload manifest.xml in Word → My Add-ins"
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

# Start other services (always include word-addin for local testing)
if [[ "$USE_TUNNEL" == true ]]; then
  # Include mobile app when using tunnel (for phone debugging via m-dev.bojin-law.com)
  pnpm --parallel --filter=@legal-platform/gateway --filter=@legal-platform/ai-service --filter=@legal-platform/database --filter=@legal-platform/word-addin --filter=@legal-platform/mobile dev &
else
  pnpm --parallel --filter=@legal-platform/gateway --filter=@legal-platform/ai-service --filter=@legal-platform/database --filter=@legal-platform/word-addin dev &
fi
SERVICES_PID=$!

# Wait for any to exit
wait $WEB_PID $SERVICES_PID
