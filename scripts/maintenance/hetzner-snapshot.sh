#!/usr/bin/env bash

# Hetzner Cloud Snapshot Script
# Creates weekly snapshots for disaster recovery
#
# Usage: ./hetzner-snapshot.sh
# Cron:  0 4 * * 0 /opt/legal-platform/scripts/hetzner-snapshot.sh
#
# Requires: HETZNER_API_TOKEN in .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

# Configuration
SERVER_ID="${HETZNER_SERVER_ID:-}"  # Set in .env or find via API
KEEP_SNAPSHOTS=2  # Keep last 2 snapshots
SNAPSHOT_PREFIX="legal-platform-auto"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Verify API token
if [[ -z "${HETZNER_API_TOKEN:-}" ]]; then
  log "ERROR: HETZNER_API_TOKEN not set in .env"
  exit 1
fi

API="https://api.hetzner.cloud/v1"
AUTH="Authorization: Bearer ${HETZNER_API_TOKEN}"

# Get server ID if not set
if [[ -z "$SERVER_ID" ]]; then
  log "Finding server ID..."
  SERVER_ID=$(curl -s -H "$AUTH" "$API/servers" | \
    jq -r '.servers[] | select(.name | contains("legal") or contains("coolify")) | .id' | head -1)

  if [[ -z "$SERVER_ID" ]]; then
    log "ERROR: Could not find server. Set HETZNER_SERVER_ID in .env"
    exit 1
  fi
  log "Found server ID: $SERVER_ID"
fi

# Get server name for snapshot description
SERVER_NAME=$(curl -s -H "$AUTH" "$API/servers/$SERVER_ID" | jq -r '.server.name')
log "Server: $SERVER_NAME (ID: $SERVER_ID)"

# Create snapshot
SNAPSHOT_NAME="${SNAPSHOT_PREFIX}-$(date +%Y%m%d-%H%M)"
log "Creating snapshot: $SNAPSHOT_NAME"

RESULT=$(curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"description\": \"$SNAPSHOT_NAME\", \"type\": \"snapshot\"}" \
  "$API/servers/$SERVER_ID/actions/create_image")

# Check for errors
ERROR=$(echo "$RESULT" | jq -r '.error.message // empty')
if [[ -n "$ERROR" ]]; then
  log "ERROR: $ERROR"
  "${SCRIPT_DIR}/discord-notify.sh" \
    "🔴 Snapshot Failed" \
    "Could not create Hetzner snapshot: $ERROR" \
    "error"
  exit 1
fi

ACTION_ID=$(echo "$RESULT" | jq -r '.action.id')
IMAGE_ID=$(echo "$RESULT" | jq -r '.image.id')
log "Snapshot action started: $ACTION_ID (Image ID: $IMAGE_ID)"

# Wait for completion (max 10 minutes)
log "Waiting for snapshot to complete..."
for i in {1..60}; do
  STATUS=$(curl -s -H "$AUTH" "$API/actions/$ACTION_ID" | jq -r '.action.status')

  if [[ "$STATUS" == "success" ]]; then
    log "Snapshot completed successfully!"
    break
  elif [[ "$STATUS" == "error" ]]; then
    log "ERROR: Snapshot failed"
    "${SCRIPT_DIR}/discord-notify.sh" \
      "🔴 Snapshot Failed" \
      "Hetzner snapshot action failed" \
      "error"
    exit 1
  fi

  sleep 10
done

# Get snapshot size
SNAPSHOT_INFO=$(curl -s -H "$AUTH" "$API/images/$IMAGE_ID")
SNAPSHOT_SIZE=$(echo "$SNAPSHOT_INFO" | jq -r '.image.image_size // "unknown"')

log "Snapshot size: ${SNAPSHOT_SIZE}GB"

# Clean up old snapshots (keep last N)
log "Cleaning up old snapshots (keeping last $KEEP_SNAPSHOTS)..."

OLD_SNAPSHOTS=$(curl -s -H "$AUTH" "$API/images?type=snapshot" | \
  jq -r ".images[] | select(.description | startswith(\"$SNAPSHOT_PREFIX\")) | .id" | \
  tail -n +$((KEEP_SNAPSHOTS + 1)))

for SNAP_ID in $OLD_SNAPSHOTS; do
  log "Deleting old snapshot: $SNAP_ID"
  curl -s -X DELETE -H "$AUTH" "$API/images/$SNAP_ID"
done

# Count remaining snapshots
SNAPSHOT_COUNT=$(curl -s -H "$AUTH" "$API/images?type=snapshot" | \
  jq "[.images[] | select(.description | startswith(\"$SNAPSHOT_PREFIX\"))] | length")

# Notify success
"${SCRIPT_DIR}/discord-notify.sh" \
  "📸 Snapshot Complete" \
  "**Server:** ${SERVER_NAME}
**Snapshot:** ${SNAPSHOT_NAME}
**Size:** ${SNAPSHOT_SIZE}GB
**Total snapshots:** ${SNAPSHOT_COUNT}

Cost: ~€0.01/GB/month" \
  "success"

log "=== Snapshot Complete ==="
