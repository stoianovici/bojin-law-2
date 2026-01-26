#!/usr/bin/env bash

# Disk Space Monitoring Script
# Monitors disk usage and triggers cleanup when threshold exceeded
#
# Usage: ./disk-monitor.sh [--threshold 70]
# Cron:  0 * * * * /opt/legal-platform/scripts/disk-monitor.sh
#
# Thresholds:
#   - 70%: Warning alert
#   - 80%: Auto-cleanup + alert
#   - 90%: Emergency cleanup + critical alert

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

# Configuration
THRESHOLD="${1:-70}"  # Default 70% for warning
CLEANUP_THRESHOLD=80  # Auto-cleanup threshold
CRITICAL_THRESHOLD=90 # Emergency threshold
HOSTNAME=$(hostname)

# Get disk usage for root partition
get_disk_usage() {
  df / | tail -1 | awk '{print $5}' | sed 's/%//'
}

# Get disk details
get_disk_details() {
  df -h / | tail -1 | awk '{print "Used: "$3" / "$2" ("$5")"}'
}

# Get Docker disk usage
get_docker_usage() {
  if command -v docker &> /dev/null; then
    docker system df --format "Images: {{.Size}} | Containers: {{.TotalCount}}" 2>/dev/null | head -1 || echo "N/A"
  else
    echo "Docker not available"
  fi
}

# Run Docker cleanup
run_cleanup() {
  local level="$1"
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Running $level cleanup..."

  # Standard cleanup - remove unused images older than 24h
  docker image prune -af --filter "until=24h" 2>/dev/null || true

  # Remove build cache
  docker builder prune -af --filter "until=24h" 2>/dev/null || true

  # Remove stopped containers
  docker container prune -f 2>/dev/null || true

  if [ "$level" = "emergency" ]; then
    # Emergency: more aggressive cleanup
    docker image prune -af 2>/dev/null || true
    docker builder prune -af 2>/dev/null || true
    docker volume prune -f 2>/dev/null || true
    docker network prune -f 2>/dev/null || true
  fi
}

# Main check
USAGE=$(get_disk_usage)
DETAILS=$(get_disk_details)
DOCKER_USAGE=$(get_docker_usage)

if [ "$USAGE" -gt "$CRITICAL_THRESHOLD" ]; then
  # Critical: Emergency cleanup + alert
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🔴 Disk Space Critical - Emergency Cleanup" \
    "Server **${HOSTNAME}** disk at **${USAGE}%**

**Disk:** ${DETAILS}
**Docker:** ${DOCKER_USAGE}

Running emergency cleanup..." \
    "error"

  run_cleanup "emergency"

  # Report result
  NEW_USAGE=$(get_disk_usage)
  FREED=$((USAGE - NEW_USAGE))
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🧹 Emergency Cleanup Complete" \
    "Freed **${FREED}%** disk space

**Before:** ${USAGE}%
**After:** ${NEW_USAGE}%" \
    "success"

elif [ "$USAGE" -gt "$CLEANUP_THRESHOLD" ]; then
  # High usage: Auto-cleanup + warning
  "${SCRIPT_DIR}/discord-notify.sh" \
    "⚠️ Disk Space High - Auto Cleanup" \
    "Server **${HOSTNAME}** disk at **${USAGE}%**

Running automatic cleanup..." \
    "warning"

  run_cleanup "standard"

  NEW_USAGE=$(get_disk_usage)
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Cleanup complete: ${USAGE}% -> ${NEW_USAGE}%"

elif [ "$USAGE" -gt "$THRESHOLD" ]; then
  # Warning only
  "${SCRIPT_DIR}/discord-notify.sh" \
    "⚠️ Disk Space Warning" \
    "Server **${HOSTNAME}** disk at **${USAGE}%**

**Disk:** ${DETAILS}
**Docker:** ${DOCKER_USAGE}

Cleanup will trigger at ${CLEANUP_THRESHOLD}%." \
    "warning"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Disk check: ${USAGE}% (warn: ${THRESHOLD}%, cleanup: ${CLEANUP_THRESHOLD}%, critical: ${CRITICAL_THRESHOLD}%)"
