#!/bin/bash
# View Render deployment logs
# Usage: ./scripts/deploy-logs.sh [service] [deploy-id]
#   service: web, gateway, ai, legacy (default: gateway)
#   deploy-id: specific deploy ID (default: latest)

set -e

# Service name to ID mapping
declare -A SERVICES=(
  ["web"]="srv-d4dk9fodl3ps73d3d7ig"
  ["gateway"]="srv-d4pkv8q4i8rc73fq3mvg"
  ["ai"]="srv-d4uor5be5dus73a0hs3g"
  ["legacy"]="srv-d4k84gogjchc73a0lqo0"
)

SERVICE_NAME="${1:-gateway}"
SERVICE_ID="${SERVICES[$SERVICE_NAME]}"

if [ -z "$SERVICE_ID" ]; then
  echo "Unknown service: $SERVICE_NAME"
  echo "Available: web, gateway, ai, legacy"
  exit 1
fi

# Get deploy ID (latest if not specified)
if [ -n "$2" ]; then
  DEPLOY_ID="$2"
else
  DEPLOY_ID=$(render deploys list "$SERVICE_ID" -o json 2>/dev/null | jq -r '.[0].id')
fi

echo "=== Logs for $SERVICE_NAME (deploy: $DEPLOY_ID) ==="
echo ""

# Get logs
render logs --resource "$DEPLOY_ID" -o text 2>/dev/null || echo "No logs available yet"
