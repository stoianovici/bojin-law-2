#!/bin/bash
# Check Coolify deployment status for all services
# Usage: ./scripts/deploy-status.sh [--watch]

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

# Service UUIDs
SERVICES=(
  "fkg48gw4c8o0c4gs40wkowoc:web"
  "t8g4o04gk84ccc4skkcook4c:gateway"
  "a4g08w08cokosksswsgcoksw:ai-service"
)

check_status() {
  echo "=== Coolify Deployment Status ==="
  echo ""
  printf "%-15s %-20s %-10s\n" "SERVICE" "STATUS" "FQDN"
  printf "%-15s %-20s %-10s\n" "-------" "------" "----"

  for svc in "${SERVICES[@]}"; do
    IFS=':' read -r uuid name <<< "$svc"

    result=$(curl -s -X GET "${COOLIFY_URL}/api/v1/applications/${uuid}" \
      -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
      -H "Accept: application/json")

    status=$(echo "$result" | jq -r '.status // "unknown"')
    fqdn=$(echo "$result" | jq -r '.fqdn // "N/A"')

    # Color status
    case "$status" in
      running:healthy) status="✅ healthy" ;;
      running:unhealthy) status="⚠️  unhealthy" ;;
      running*) status="🔄 running" ;;
      stopped) status="⏹️  stopped" ;;
      *) status="⚪ $status" ;;
    esac

    printf "%-15s %-20s %s\n" "$name" "$status" "$fqdn"
  done
  echo ""

  # Also check recent deployments
  echo "=== Recent Deployments ==="
  echo ""

  for svc in "${SERVICES[@]}"; do
    IFS=':' read -r uuid name <<< "$svc"

    # Get most recent deployment
    result=$(curl -s -X GET "${COOLIFY_URL}/api/v1/applications/${uuid}" \
      -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
      -H "Accept: application/json")

    commit=$(echo "$result" | jq -r '.git_commit_sha // "unknown"' | cut -c1-7)
    echo "$name: commit $commit"
  done
  echo ""
}

# Main
if [ "$1" == "--watch" ]; then
  while true; do
    clear
    check_status
    echo "Refreshing in 10s... (Ctrl+C to stop)"
    sleep 10
  done
else
  check_status
fi
