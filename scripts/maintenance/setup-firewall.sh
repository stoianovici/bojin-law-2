#!/usr/bin/env bash

# UFW Firewall Setup Script for Hetzner/Coolify Server
# Configures basic firewall rules for the Legal Platform
#
# Usage: ./setup-firewall.sh [--dry-run]
# Run as root on the server

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
fi

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

# Check if running as root
if [[ $EUID -ne 0 ]] && [[ "$DRY_RUN" == false ]]; then
  echo "This script must be run as root"
  exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
  log "Installing UFW..."
  if [[ "$DRY_RUN" == false ]]; then
    apt-get update && apt-get install -y ufw
  else
    echo "Would install: ufw"
  fi
fi

log "=== Current Firewall Status ==="
ufw status verbose 2>/dev/null || echo "UFW not configured"

log "=== Configuring Firewall Rules ==="

run_cmd() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "Would run: $*"
  else
    "$@"
  fi
}

# Reset to defaults (careful!)
log "Setting default policies..."
run_cmd ufw default deny incoming
run_cmd ufw default allow outgoing

# SSH - Essential (don't lock yourself out!)
log "Allowing SSH (port 22)..."
run_cmd ufw allow 22/tcp comment 'SSH'

# HTTP/HTTPS - Web traffic
log "Allowing HTTP (port 80)..."
run_cmd ufw allow 80/tcp comment 'HTTP'

log "Allowing HTTPS (port 443)..."
run_cmd ufw allow 443/tcp comment 'HTTPS'

# Coolify Dashboard - Port 8000
# Consider restricting to specific IPs or using VPN
log "Allowing Coolify Dashboard (port 8000)..."
run_cmd ufw allow 8000/tcp comment 'Coolify Dashboard'

# Optional: Restrict Coolify to specific IP
# Uncomment and modify with your IP:
# run_cmd ufw allow from YOUR.IP.HERE to any port 8000 proto tcp comment 'Coolify Dashboard (restricted)'

# Rate limiting for SSH (prevent brute force)
log "Enabling rate limiting for SSH..."
run_cmd ufw limit 22/tcp comment 'SSH rate limit'

# Enable UFW
if [[ "$DRY_RUN" == false ]]; then
  log "Enabling UFW..."
  echo "y" | ufw enable
else
  echo "Would enable UFW"
fi

log "=== Final Firewall Status ==="
ufw status verbose

log "=== Firewall Setup Complete ==="

cat << 'EOF'

IMPORTANT NOTES:
================

1. SSH Access: Port 22 is open with rate limiting
   - If you get locked out, use Hetzner Console

2. Coolify Dashboard: Port 8000 is open to all
   - Consider restricting to your IP:
     ufw delete allow 8000/tcp
     ufw allow from YOUR.IP.HERE to any port 8000 proto tcp

3. To add more rules:
   ufw allow <port>/tcp
   ufw allow from <ip> to any port <port>

4. To check status:
   ufw status numbered

5. To remove a rule:
   ufw delete <rule-number>

EOF
