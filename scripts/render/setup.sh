#!/usr/bin/env bash

# Initial setup for new developers
# Configures Render CLI and validates environment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Initial setup for Render development environment.

Options:
  -h, --help      Show this help message

This script will:
  1. Check if Render CLI is installed
  2. Guide you through Render CLI login
  3. Validate API key configuration
  4. Test connectivity to Render services
  5. Display next steps

Environment Variables (will be configured):
  RENDER_API_KEY                Render API key
  RENDER_DEPLOY_HOOK_STAGING    Deploy hook for staging
  RENDER_DEPLOY_HOOK_PRODUCTION Deploy hook for production

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
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      ;;
  esac
done

# Display welcome message
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Render Development Environment Setup                   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check Node.js
log "Step 1: Checking Node.js installation..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  log_success "Node.js installed: $NODE_VERSION"
else
  log_error "Node.js is not installed"
  log "Install Node.js 20+ from: https://nodejs.org/"
  exit 1
fi

# Step 2: Check Render CLI
log "Step 2: Checking Render CLI installation..."
if command -v render &> /dev/null; then
  log_success "Render CLI is installed"
else
  log_warning "Render CLI is not installed"
  echo ""
  echo "Install Render CLI:"
  echo "  npm install -g @render/cli"
  echo ""
  echo -n "Would you like to install it now? (yes/no): "
  read -r INSTALL_CLI

  if [[ "$INSTALL_CLI" == "yes" ]]; then
    log "Installing Render CLI..."
    if npm install -g @render/cli; then
      log_success "Render CLI installed successfully"
    else
      log_error "Failed to install Render CLI"
      exit 1
    fi
  else
    log_error "Render CLI is required. Please install it manually."
    exit 1
  fi
fi

# Step 3: Login to Render
log "Step 3: Checking Render CLI authentication..."
if render whoami &> /dev/null; then
  log_success "Already logged in to Render"
else
  log_warning "Not logged in to Render"
  echo ""
  echo "You need to login to Render CLI:"
  echo "  render login"
  echo ""
  echo -n "Would you like to login now? (yes/no): "
  read -r DO_LOGIN

  if [[ "$DO_LOGIN" == "yes" ]]; then
    log "Opening Render login..."
    render login
    log_success "Logged in successfully"
  else
    log_warning "Skipping login. Run 'render login' manually later."
  fi
fi

# Step 4: Check environment variables
log "Step 4: Checking environment variables..."

MISSING_VARS=()

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  MISSING_VARS+=("RENDER_API_KEY")
fi

if [[ -z "${RENDER_DEPLOY_HOOK_STAGING:-}" ]]; then
  MISSING_VARS+=("RENDER_DEPLOY_HOOK_STAGING")
fi

if [[ -z "${RENDER_DEPLOY_HOOK_PRODUCTION:-}" ]]; then
  MISSING_VARS+=("RENDER_DEPLOY_HOOK_PRODUCTION")
fi

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  log_warning "Missing environment variables: ${MISSING_VARS[*]}"
  echo ""
  echo "To configure these variables, add to your shell profile (~/.bashrc, ~/.zshrc):"
  echo ""
  echo "  export RENDER_API_KEY='your-api-key'"
  echo "  export RENDER_DEPLOY_HOOK_STAGING='staging-deploy-hook-url'"
  echo "  export RENDER_DEPLOY_HOOK_PRODUCTION='production-deploy-hook-url'"
  echo ""
  echo "Get these values from:"
  echo "  - API Key: https://dashboard.render.com/account/settings"
  echo "  - Deploy Hooks: https://dashboard.render.com/ (Settings → Deploy Hook)"
  echo ""
else
  log_success "All required environment variables are set"
fi

# Step 5: Test connectivity
log "Step 5: Testing Render connectivity..."
if render services ls &> /dev/null; then
  log_success "Successfully connected to Render API"
else
  log_warning "Could not connect to Render API (may need to login)"
fi

# Step 6: Display next steps
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo ""
echo "Next Steps:"
echo "  1. Configure environment variables (if not done already)"
echo "  2. Test deployment: ./scripts/render/deploy.sh staging"
echo "  3. View logs: ./scripts/render/logs.sh web --follow"
echo "  4. Check status: ./scripts/render/status.sh"
echo ""
echo "Available Scripts:"
echo "  deploy.sh       - Deploy to staging or production"
echo "  logs.sh         - View service logs"
echo "  shell.sh        - Open shell in a service"
echo "  status.sh       - Check all services status"
echo "  db-backup.sh    - Backup database"
echo "  db-restore.sh   - Restore database from backup"
echo "  env-sync.sh     - Sync environment variables"
echo ""
echo "Documentation:"
echo "  - Deployment Guide: infrastructure/DEPLOYMENT_GUIDE.md"
echo "  - Operations Runbook: infrastructure/OPERATIONS_RUNBOOK.md"
echo "  - Local Development: infrastructure/LOCAL_DEVELOPMENT.md"
echo ""
echo "Dashboard: https://dashboard.render.com/"
echo ""
