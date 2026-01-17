#!/bin/bash
# Check Render deployment status for all services
# Usage: ./scripts/deploy-status.sh [--watch]

set -e

# Service IDs
SERVICES=(
  "srv-d4dk9fodl3ps73d3d7ig:legal-platform-web"
  "srv-d4pkv8q4i8rc73fq3mvg:legal-platform-gateway"
  "srv-d4uor5be5dus73a0hs3g:legal-platform-ai-service"
  "srv-d4k84gogjchc73a0lqo0:bojin-legacy-import"
)

check_status() {
  echo "=== Render Deployment Status ==="
  echo ""
  printf "%-25s %-20s %-10s %s\n" "SERVICE" "STATUS" "COMMIT" "MESSAGE"
  printf "%-25s %-20s %-10s %s\n" "-------" "------" "------" "-------"

  for svc in "${SERVICES[@]}"; do
    IFS=':' read -r id name <<< "$svc"
    result=$(render deploys list "$id" -o json 2>/dev/null | jq -r '.[0] | "\(.status)|\(.commit.id[0:7])|\(.commit.message | split("\n")[0][0:40])"')
    IFS='|' read -r status commit msg <<< "$result"

    # Color status
    case "$status" in
      live) status="✅ live" ;;
      build_in_progress) status="🔄 building" ;;
      update_in_progress) status="🔄 updating" ;;
      build_failed) status="❌ failed" ;;
      *) status="⚪ $status" ;;
    esac

    printf "%-25s %-20s %-10s %s\n" "$name" "$status" "$commit" "$msg"
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
