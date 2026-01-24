#!/bin/bash
# Trigger Coolify deployment for services
# Usage: ./scripts/deploy-trigger.sh [service|all]
#   service: web, gateway, ai, all (default: all)

set -e

# Load environment
if [ -f .env.local ]; then
  export $(grep -E '^COOLIFY_API_TOKEN=' .env.local | xargs)
fi

if [ -z "$COOLIFY_API_TOKEN" ]; then
  echo "Error: COOLIFY_API_TOKEN not set in .env.local"
  exit 1
fi

COOLIFY_URL="http://135.181.44.197:8000"

# Service name to UUID mapping
declare -A SERVICES=(
  ["web"]="fkg48gw4c8o0c4gs40wkowoc"
  ["gateway"]="t8g4o04gk84ccc4skkcook4c"
  ["ai"]="a4g08w08cokosksswsgcoksw"
)

deploy_service() {
  local name="$1"
  local uuid="${SERVICES[$name]}"
  echo "Deploying $name ($uuid)..."

  result=$(curl -s -X POST "${COOLIFY_URL}/api/v1/deploy?uuid=${uuid}" \
    -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
    -H "Accept: application/json")

  deployment_uuid=$(echo "$result" | jq -r '.deployments[0].deployment_uuid // "unknown"')
  message=$(echo "$result" | jq -r '.deployments[0].message // .message // "Deploy triggered"')

  echo "  $message"
  echo "  Deployment UUID: $deployment_uuid"
}

TARGET="${1:-all}"

if [ "$TARGET" == "all" ]; then
  for name in web gateway ai; do
    deploy_service "$name"
    echo ""
  done
else
  if [ -z "${SERVICES[$TARGET]}" ]; then
    echo "Unknown service: $TARGET"
    echo "Available: web, gateway, ai, all"
    exit 1
  fi
  deploy_service "$TARGET"
fi

echo ""
echo "Run ./scripts/deploy-status.sh to monitor progress"
