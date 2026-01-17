#!/bin/bash
# Trigger Render deployment for services
# Usage: ./scripts/deploy-trigger.sh [service|all]
#   service: web, gateway, ai, legacy, all (default: all)

set -e

# Service name to ID mapping
declare -A SERVICES=(
  ["web"]="srv-d4dk9fodl3ps73d3d7ig"
  ["gateway"]="srv-d4pkv8q4i8rc73fq3mvg"
  ["ai"]="srv-d4uor5be5dus73a0hs3g"
  ["legacy"]="srv-d4k84gogjchc73a0lqo0"
)

deploy_service() {
  local name="$1"
  local id="${SERVICES[$name]}"
  echo "Deploying $name ($id)..."
  render deploys create "$id" -o json 2>/dev/null | jq -r '"  Deploy ID: \(.id) - Status: \(.status)"'
}

TARGET="${1:-all}"

if [ "$TARGET" == "all" ]; then
  for name in web gateway ai; do
    deploy_service "$name"
  done
else
  if [ -z "${SERVICES[$TARGET]}" ]; then
    echo "Unknown service: $TARGET"
    echo "Available: web, gateway, ai, legacy, all"
    exit 1
  fi
  deploy_service "$TARGET"
fi

echo ""
echo "Run ./scripts/deploy-status.sh to monitor progress"
