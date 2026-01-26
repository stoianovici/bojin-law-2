#!/usr/bin/env bash

# Setup Maintenance Cron Jobs on Hetzner Server
# Run this script on the server to install all maintenance automation
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
    "disk-monitor.sh"
    "memory-monitor.sh"
    "docker-cleanup.sh"
    "hetzner-snapshot.sh"
    "setup-firewall.sh"
    "setup-docker-logging.sh"
  )

  for script in "${scripts[@]}"; do
    if [[ -f "${source_dir}/${script}" ]]; then
      if [[ "$DRY_RUN" == true ]]; then
        echo "  Would copy: $script -> ${SCRIPT_DIR}/${script}"
      else
        cp "${source_dir}/${script}" "${SCRIPT_DIR}/${script}"
        chmod +x "${SCRIPT_DIR}/${script}"
        log "  Copied: $script"
      fi
    else
      log "  WARNING: $script not found in source directory"
    fi
  done

  # Copy logrotate config
  if [[ -f "${source_dir}/logrotate.conf" ]]; then
    if [[ "$DRY_RUN" == true ]]; then
      echo "  Would copy: logrotate.conf -> /etc/logrotate.d/legal-platform"
    else
      cp "${source_dir}/logrotate.conf" /etc/logrotate.d/legal-platform
      chmod 644 /etc/logrotate.d/legal-platform
      log "  Copied: logrotate.conf -> /etc/logrotate.d/legal-platform"
    fi
  fi
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
# Legal Platform Maintenance Environment Variables
# Fill in these values from your Coolify/production configuration

# =============================================================================
# Database Backup (Required)
# =============================================================================
# PostgreSQL - Get from Coolify PostgreSQL service
DATABASE_URL=postgresql://legal_platform:PASSWORD@10.0.1.7:5432/legal_platform

# =============================================================================
# Cloudflare R2 Storage (Required for backups)
# =============================================================================
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET_NAME=legal-platform-backups

# =============================================================================
# Hetzner Cloud (Required for snapshots)
# =============================================================================
# Get from Hetzner Cloud Console -> Security -> API Tokens
HETZNER_API_TOKEN=your_hetzner_api_token

# Optional: Specify server ID (auto-detected if not set)
# HETZNER_SERVER_ID=12345678

# =============================================================================
# Discord Notifications (Optional - has default)
# =============================================================================
# Create webhook: Discord Server Settings -> Integrations -> Webhooks
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# =============================================================================
# Monitoring Thresholds (Optional - has defaults)
# =============================================================================
# DISK_THRESHOLD=80       # Alert when disk usage exceeds this %
# MEMORY_THRESHOLD=85     # Alert when memory usage exceeds this %
# BACKUP_RETENTION_DAYS=30
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
# Last updated: $(date +'%Y-%m-%d %H:%M:%S')

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# =============================================================================
# MONITORING (High Frequency)
# =============================================================================

# Disk space monitoring - every 6 hours
0 */6 * * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/disk-monitor.sh >> ${LOG_DIR}/disk-monitor.log 2>&1

# Memory monitoring - every 30 minutes
*/30 * * * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/memory-monitor.sh >> ${LOG_DIR}/memory-monitor.log 2>&1

# =============================================================================
# BACKUPS (Daily)
# =============================================================================

# Database backup - daily at 3 AM
0 3 * * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-backup.sh >> ${LOG_DIR}/backup.log 2>&1

# =============================================================================
# MAINTENANCE (Weekly)
# =============================================================================

# Database VACUUM/ANALYZE - Sunday at 4 AM
0 4 * * 0 root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-maintenance.sh >> ${LOG_DIR}/maintenance.log 2>&1

# Docker cleanup - Sunday at 3 AM (before db-maintenance)
0 3 * * 0 root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/docker-cleanup.sh >> ${LOG_DIR}/docker-cleanup.log 2>&1

# Hetzner snapshot - Sunday at 5 AM (after maintenance)
0 5 * * 0 root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/hetzner-snapshot.sh >> ${LOG_DIR}/snapshot.log 2>&1

# =============================================================================
# VERIFICATION (Monthly)
# =============================================================================

# Backup verification - 1st of month at 5 AM
0 5 1 * * root . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/verify-backup.sh >> ${LOG_DIR}/verify.log 2>&1

# =============================================================================
# LOG MANAGEMENT
# =============================================================================

# Rotate/clean old logs - 1st of month at 2 AM
0 2 1 * * root find ${LOG_DIR} -name "*.log" -mtime +90 -delete

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

  local all_ok=true

  if [[ "$DRY_RUN" == true ]]; then
    echo "  Would verify scripts are executable"
    echo "  Would verify cron syntax"
  else
    # Check scripts exist and are executable
    local scripts=(
      "discord-notify.sh"
      "db-backup.sh"
      "db-maintenance.sh"
      "verify-backup.sh"
      "disk-monitor.sh"
      "memory-monitor.sh"
      "docker-cleanup.sh"
      "hetzner-snapshot.sh"
    )

    for script in "${scripts[@]}"; do
      if [[ -x "${SCRIPT_DIR}/${script}" ]]; then
        log "  ✓ ${script}"
      else
        log "  ✗ ${script} (missing or not executable)"
        all_ok=false
      fi
    done

    # Check logrotate config
    if [[ -f "/etc/logrotate.d/legal-platform" ]]; then
      log "  ✓ logrotate config"
    else
      log "  ✗ logrotate config"
      all_ok=false
    fi

    # Verify cron syntax
    if [[ -f "$CRON_FILE" ]]; then
      log "  ✓ cron file"
    else
      log "  ✗ cron file"
      all_ok=false
    fi

    # Check environment file
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
      log "  ✓ environment file (remember to configure!)"
    else
      log "  ✗ environment file"
      all_ok=false
    fi

    if [[ "$all_ok" == false ]]; then
      log ""
      log "WARNING: Some components are missing. Review above."
    fi
  fi
}

# Print summary
print_summary() {
  log ""
  log "=============================================="
  log "     Legal Platform Maintenance Setup"
  log "=============================================="
  log ""
  log "Schedule:"
  log "  ┌─────────────────────────────────────────┐"
  log "  │ MONITORING                              │"
  log "  │   Memory check:     Every 30 minutes   │"
  log "  │   Disk check:       Every 6 hours      │"
  log "  ├─────────────────────────────────────────┤"
  log "  │ DAILY                                   │"
  log "  │   Database backup:  3:00 AM            │"
  log "  ├─────────────────────────────────────────┤"
  log "  │ WEEKLY (Sunday)                        │"
  log "  │   Docker cleanup:   3:00 AM            │"
  log "  │   DB maintenance:   4:00 AM            │"
  log "  │   Hetzner snapshot: 5:00 AM            │"
  log "  ├─────────────────────────────────────────┤"
  log "  │ MONTHLY (1st)                          │"
  log "  │   Backup verify:    5:00 AM            │"
  log "  │   Log cleanup:      2:00 AM            │"
  log "  └─────────────────────────────────────────┘"
  log ""
  log "Logs: ${LOG_DIR}/"
  log "  - backup.log, maintenance.log, verify.log"
  log "  - disk-monitor.log, memory-monitor.log"
  log "  - docker-cleanup.log, snapshot.log"
  log ""
  log "=============================================="
  log "            ⚠️  ACTION REQUIRED  ⚠️"
  log "=============================================="
  log ""
  log "1. Edit credentials:"
  log "   nano ${SCRIPT_DIR}/.env"
  log ""
  log "2. Test backup manually:"
  log "   . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/db-backup.sh"
  log ""
  log "3. Test disk monitor:"
  log "   . ${SCRIPT_DIR}/.env && ${SCRIPT_DIR}/disk-monitor.sh"
  log ""
  log "4. Run one-time setup scripts:"
  log "   ${SCRIPT_DIR}/setup-firewall.sh"
  log "   ${SCRIPT_DIR}/setup-docker-logging.sh"
  log ""
}

# Main
main() {
  log "=== Legal Platform Maintenance Setup ==="
  log ""

  create_directories
  copy_scripts
  create_env_file
  install_crons
  verify_installation
  print_summary
}

main "$@"
