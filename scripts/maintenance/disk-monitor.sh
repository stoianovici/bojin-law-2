#!/usr/bin/env bash

# Disk Space Monitoring Script
# Alerts via Discord when disk usage exceeds threshold
#
# Usage: ./disk-monitor.sh [--threshold 80]
# Cron:  0 */6 * * * /opt/legal-platform/scripts/disk-monitor.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

# Configuration
THRESHOLD="${1:-80}"  # Default 80%
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

# Main check
USAGE=$(get_disk_usage)
DETAILS=$(get_disk_details)
DOCKER_USAGE=$(get_docker_usage)

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  # Critical alert
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🔴 Disk Space Critical" \
    "Server **${HOSTNAME}** disk usage at **${USAGE}%**

**Disk:** ${DETAILS}
**Docker:** ${DOCKER_USAGE}

**Action Required:**
\`\`\`bash
# Clean Docker
docker system prune -af --volumes

# Check large files
du -sh /var/log/*
du -sh /var/lib/docker/*
\`\`\`" \
    "error"

  exit 1

elif [ "$USAGE" -gt $((THRESHOLD - 10)) ]; then
  # Warning (within 10% of threshold)
  "${SCRIPT_DIR}/discord-notify.sh" \
    "⚠️ Disk Space Warning" \
    "Server **${HOSTNAME}** disk usage at **${USAGE}%**

**Disk:** ${DETAILS}
**Docker:** ${DOCKER_USAGE}

Consider cleaning up soon." \
    "warning"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Disk check: ${USAGE}% (threshold: ${THRESHOLD}%)"
