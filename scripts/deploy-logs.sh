#!/bin/bash
# View Coolify service logs via SSH
# Usage: ./scripts/deploy-logs.sh [service] [lines]
#   service: web, gateway, ai (default: gateway)
#   lines: number of lines to show (default: 100)

set -e

HETZNER_IP="135.181.44.197"

# Service name to UUID mapping
declare -A SERVICES=(
  ["web"]="fkg48gw4c8o0c4gs40wkowoc"
  ["gateway"]="t8g4o04gk84ccc4skkcook4c"
  ["ai"]="a4g08w08cokosksswsgcoksw"
)

SERVICE_NAME="${1:-gateway}"
SERVICE_UUID="${SERVICES[$SERVICE_NAME]}"
LINES="${2:-100}"

if [ -z "$SERVICE_UUID" ]; then
  echo "Unknown service: $SERVICE_NAME"
  echo "Available: web, gateway, ai"
  exit 1
fi

echo "=== Logs for $SERVICE_NAME (last $LINES lines) ==="
echo ""

# Find the running container and get logs
CONTAINER=$(ssh root@${HETZNER_IP} "docker ps --format '{{.Names}}' | grep '^${SERVICE_UUID}' | head -1")

if [ -z "$CONTAINER" ]; then
  echo "No running container found for $SERVICE_NAME"
  exit 1
fi

echo "Container: $CONTAINER"
echo ""

ssh root@${HETZNER_IP} "docker logs --tail ${LINES} ${CONTAINER} 2>&1"
