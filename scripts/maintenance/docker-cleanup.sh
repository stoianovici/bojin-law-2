#!/usr/bin/env bash

# Docker Cleanup Script
# Removes unused Docker resources to free disk space
#
# Usage: ./docker-cleanup.sh [--dry-run]
# Cron:  0 3 * * 0 /opt/legal-platform/scripts/docker-cleanup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
fi

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Get disk usage before cleanup
DISK_BEFORE=$(df / | tail -1 | awk '{print $5}')

log "Starting Docker cleanup..."
log "Disk usage before: $DISK_BEFORE"

# Show what would be cleaned
log "=== Docker System Overview ==="
docker system df

if [[ "$DRY_RUN" == true ]]; then
  log "=== Would clean the following ==="
  docker system prune -af --volumes --filter "until=168h" --dry-run 2>/dev/null || true
else
  log "=== Cleaning unused resources older than 7 days ==="

  # Remove dangling images
  log "Removing dangling images..."
  docker image prune -f --filter "until=168h" 2>/dev/null || true

  # Remove unused images (not used by any container)
  log "Removing unused images..."
  docker image prune -af --filter "until=168h" 2>/dev/null || true

  # Remove stopped containers older than 7 days
  log "Removing old stopped containers..."
  docker container prune -f --filter "until=168h" 2>/dev/null || true

  # Remove unused volumes (careful - this removes data!)
  log "Removing unused volumes..."
  docker volume prune -f 2>/dev/null || true

  # Remove unused networks
  log "Removing unused networks..."
  docker network prune -f --filter "until=168h" 2>/dev/null || true

  # Remove build cache
  log "Removing build cache..."
  docker builder prune -f --filter "until=168h" 2>/dev/null || true
fi

# Get disk usage after cleanup
DISK_AFTER=$(df / | tail -1 | awk '{print $5}')

log "=== Cleanup Complete ==="
log "Disk usage: $DISK_BEFORE -> $DISK_AFTER"

# Show final state
docker system df

# Notify if significant space was freed
BEFORE_NUM=$(echo "$DISK_BEFORE" | sed 's/%//')
AFTER_NUM=$(echo "$DISK_AFTER" | sed 's/%//')
FREED=$((BEFORE_NUM - AFTER_NUM))

if [ "$FREED" -gt 5 ] && [[ "$DRY_RUN" == false ]]; then
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🧹 Docker Cleanup Complete" \
    "Freed **${FREED}%** disk space

**Before:** ${DISK_BEFORE}
**After:** ${DISK_AFTER}" \
    "success"
fi
