#!/usr/bin/env bash

# Docker Logging Configuration
# Prevents Docker logs from filling up disk
#
# Usage: ./setup-docker-logging.sh
# Run as root on the server

set -euo pipefail

DOCKER_DAEMON_CONFIG="/etc/docker/daemon.json"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root"
  exit 1
fi

log "Configuring Docker logging..."

# Backup existing config
if [[ -f "$DOCKER_DAEMON_CONFIG" ]]; then
  log "Backing up existing daemon.json..."
  cp "$DOCKER_DAEMON_CONFIG" "${DOCKER_DAEMON_CONFIG}.backup.$(date +%Y%m%d)"
fi

# Check if config exists and has content
if [[ -f "$DOCKER_DAEMON_CONFIG" ]] && [[ -s "$DOCKER_DAEMON_CONFIG" ]]; then
  log "Existing daemon.json found. Merging log configuration..."

  # Use jq to merge if available
  if command -v jq &> /dev/null; then
    jq '. + {"log-driver": "json-file", "log-opts": {"max-size": "50m", "max-file": "3"}}' \
      "$DOCKER_DAEMON_CONFIG" > "${DOCKER_DAEMON_CONFIG}.tmp"
    mv "${DOCKER_DAEMON_CONFIG}.tmp" "$DOCKER_DAEMON_CONFIG"
  else
    log "WARNING: jq not installed. Please manually add log config to daemon.json"
    cat << 'EOF'
Add to /etc/docker/daemon.json:

{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
    exit 1
  fi
else
  log "Creating new daemon.json..."
  cat > "$DOCKER_DAEMON_CONFIG" << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
fi

log "Docker daemon configuration:"
cat "$DOCKER_DAEMON_CONFIG"

log "Restarting Docker daemon..."
systemctl restart docker

log "Verifying Docker is running..."
docker info | grep -E "(Logging Driver|Log)"

log "=== Docker Logging Setup Complete ==="

cat << 'EOF'

Configuration Applied:
=====================
- Log driver: json-file
- Max size per log: 50MB
- Max log files: 3 (rotated automatically)

This limits each container to ~150MB of logs total.

To check current container log sizes:
  du -sh /var/lib/docker/containers/*/

To view logs:
  docker logs <container-name>
  docker logs --tail 100 <container-name>

EOF
