#!/usr/bin/env bash

# Enable auto-deploy for all Render services
# Uses Render API to update service settings

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*" >&2; }

# Service IDs from render.yaml
SERVICES="web:srv-d4dk9fodl3ps73d3d7ig gateway:srv-d4pkv8q4i8rc73fq3mvg ai-service:srv-d4uor5be5dus73a0hs3g"

# Check for API key
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  # Try to load from .env.render
  if [[ -f "$(dirname "$0")/../../.env.render" ]]; then
    source "$(dirname "$0")/../../.env.render"
  fi
fi

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  log_error "RENDER_API_KEY is not set"
  echo "Get your API key from: https://dashboard.render.com/account/settings"
  echo "Then run: export RENDER_API_KEY='your-key'"
  exit 1
fi

log "Enabling auto-deploy for all services..."
echo ""

for service in $SERVICES; do
  name="${service%%:*}"
  service_id="${service##*:}"
  log "Updating $name ($service_id)..."

  http_code=$(curl -s -o /tmp/render_response.json -w "%{http_code}" -X PATCH \
    "https://api.render.com/v1/services/$service_id" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"autoDeploy": "yes"}')

  body=$(cat /tmp/render_response.json 2>/dev/null || echo "")

  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    log_success "$name: auto-deploy enabled"
  else
    log_error "$name: failed (HTTP $http_code)"
    echo "$body" | head -c 200
    echo ""
  fi
done

echo ""
log_success "Done! Services will now auto-deploy on push to main."
