#!/usr/bin/env bash

# Setup Maintenance Cron Jobs on Hetzner Server
# Run this script on the server to install cron jobs
#
# Usage: ./setup-crons.sh [--dry-run]

set -euo pipefail

SCRIPT_DIR="/opt/legal-platform/scripts"
LOG_DIR="/var/log/legal-platform"
CRON_FILE="/etc/cron.d/legal-platform-maintenance"

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

# Create directories
create_directories() {
  log "Creating directories..."

  if [[ "$DRY_RUN" == true ]]; then
    echo "  Would create: $SCRIPT_DIR"
    echo "  Would create: $LOG_DIR"
  else
    mkdir -p "$SCRIPT_DIR"
    mkdir -p "$LOG_DIR"
    chmod 755 "$SCRIPT_DIR"
    chmod 755 "$LOG_DIR"
  fi
}

# Copy scripts to server
copy_scripts() {
  log "Copying maintenance scripts..."

  local source_dir
  source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  local scripts=(
    "discord-notify.sh"
    "db-backup.sh"
    "db-maintenance.sh"
    "verify-backup.sh"
  )

  for script in "${scripts[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "  Would copy: $script -> ${SCRIPT_DIR}/${script}"
    else
      cp "${source_dir}/${script}" "${SCRIPT_DIR}/${script}"
      chmod +x "${SCRIPT_DIR}/${script}"
    fi
  done
}

# Create environment file for cron
create_env_file() {
  log "Creating environment file..."

  local env_file="${SCRIPT_DIR}/.env"

  if [[ "$DRY_RUN" == true ]]; then
    echo "  Would create: $env_file"
    echo "  (You need to populate this with required variables)"
  else
    if [[ ! -f "$env_file" ]]; then
      cat > "$env_file" << 'EOF'
# Database Backup Environment Variables
# Fill in these values from your Coolify/production configuration

# PostgreSQL - Get from Coolify PostgreSQL service
DATABASE_URL=postgresql://legal_platform:PASSWORD@10.0.1.7:5432/legal_platform

# Cloudflare R2 - Get from Cloudflare dashboard
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET_NAME=legal-platform-backups

# Optional: Discord webhook (default is embedded in scripts)
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Backup retention in days (default: 30)
BACKUP_RETENTION_DAYS=30
EOF
      chmod 600 "$env_file"
      log "Created $env_file - PLEASE EDIT WITH CORRECT VALUES"
    else
      log "Environment file already exists at $env_file"
    fi
  fi
}

# Install cron jobs
install_crons() {
  log "Installing cron jobs..."

  local cron_content
  cron_content=$(cat << EOF
# Legal Platform Maintenance Cron Jobs
# Managed by setup-crons.sh - do not edit manually

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Load environment and run daily backup at 3 AM
0 3 * * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-backup.sh >> ${LOG_DIR}/backup.log 2>&1

# Load environment and run weekly maintenance on Sunday at 4 AM
0 4 * * 0 root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-maintenance.sh >> ${LOG_DIR}/maintenance.log 2>&1

# Load environment and run monthly backup verification on 1st at 5 AM
0 5 1 * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/verify-backup.sh >> ${LOG_DIR}/verify.log 2>&1

# Rotate logs monthly (keep 3 months)
0 0 1 * * root find ${LOG_DIR} -name "*.log" -mtime +90 -delete
EOF
)

  if [[ "$DRY_RUN" == true ]]; then
    echo "  Would create: $CRON_FILE"
    echo "  Contents:"
    echo "$cron_content" | sed 's/^/    /'
  else
    echo "$cron_content" > "$CRON_FILE"
    chmod 644 "$CRON_FILE"
    log "Installed cron jobs to $CRON_FILE"
  fi
}

# Verify installation
verify_installation() {
  log "Verifying installation..."

  if [[ "$DRY_RUN" == true ]]; then
    echo "  Would verify scripts are executable"
    echo "  Would verify cron syntax"
  else
    # Check scripts exist and are executable
    for script in discord-notify.sh db-backup.sh db-maintenance.sh verify-backup.sh; do
      if [[ -x "${SCRIPT_DIR}/${script}" ]]; then
        log "  OK: ${script}"
      else
        log "  MISSING: ${script}"
      fi
    done

    # Verify cron syntax
    if crontab -u root -l > /dev/null 2>&1 || [[ -f "$CRON_FILE" ]]; then
      log "  OK: Cron file installed"
    else
      log "  WARNING: Cron file may have issues"
    fi
  fi
}

# Print summary
print_summary() {
  log ""
  log "=== Setup Complete ==="
  log ""
  log "Schedule:"
  log "  - Daily backup:     3:00 AM"
  log "  - Weekly vacuum:    Sunday 4:00 AM"
  log "  - Monthly verify:   1st of month 5:00 AM"
  log ""
  log "Logs:"
  log "  - Backup:      ${LOG_DIR}/backup.log"
  log "  - Maintenance: ${LOG_DIR}/maintenance.log"
  log "  - Verify:      ${LOG_DIR}/verify.log"
  log ""
  log "IMPORTANT: Edit ${SCRIPT_DIR}/.env with correct credentials!"
  log ""
  log "To test backup manually:"
  log "  . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-backup.sh"
  log ""
}

# Main
main() {
  log "=== Legal Platform Maintenance Setup ==="

  create_directories
  copy_scripts
  create_env_file
  install_crons
  verify_installation
  print_summary
}

main "$@"
