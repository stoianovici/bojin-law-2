#!/usr/bin/env bash

# Memory Monitoring Script
# Alerts via Discord when memory usage exceeds threshold
#
# Usage: ./memory-monitor.sh [--threshold 85]
# Cron:  */30 * * * * /opt/legal-platform/scripts/memory-monitor.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

# Configuration
THRESHOLD="${1:-85}"  # Default 85%
HOSTNAME=$(hostname)

# Get memory usage percentage
get_memory_usage() {
  free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}'
}

# Get memory details
get_memory_details() {
  free -h | grep Mem | awk '{print "Used: "$3" / "$2}'
}

# Get top memory consumers
get_top_processes() {
  ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "%-20s %s%%\n", $11, $4}'
}

# Get Docker container memory usage
get_container_memory() {
  if command -v docker &> /dev/null; then
    docker stats --no-stream --format "{{.Name}}: {{.MemUsage}}" 2>/dev/null | head -6 || echo "N/A"
  else
    echo "Docker not available"
  fi
}

# Main check
USAGE=$(get_memory_usage)
DETAILS=$(get_memory_details)

if [ "$USAGE" -gt "$THRESHOLD" ]; then
  TOP_PROCS=$(get_top_processes)
  CONTAINER_MEM=$(get_container_memory)

  # Critical alert
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🔴 Memory Critical" \
    "Server **${HOSTNAME}** memory at **${USAGE}%**

**Memory:** ${DETAILS}

**Top Processes:**
\`\`\`
${TOP_PROCS}
\`\`\`

**Containers:**
\`\`\`
${CONTAINER_MEM}
\`\`\`

**Action:** Check for memory leaks or increase server RAM." \
    "error"

  exit 1

elif [ "$USAGE" -gt $((THRESHOLD - 10)) ]; then
  # Warning
  "${SCRIPT_DIR}/discord-notify.sh" \
    "⚠️ Memory Warning" \
    "Server **${HOSTNAME}** memory at **${USAGE}%**

**Memory:** ${DETAILS}

Monitor closely - approaching threshold." \
    "warning"
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Memory check: ${USAGE}% (threshold: ${THRESHOLD}%)"
