# Render CLI Helper Scripts

This directory contains helper scripts for managing deployments and operations on Render.com.

## Prerequisites

1. **Node.js 20+** - Required for Render CLI
2. **Render CLI** - Install with `npm install -g @render/cli`
3. **Render Account** - Sign up at https://render.com
4. **Environment Variables** - Configure required variables (see Setup)

## Quick Start

Run the setup script to configure your environment:

```bash
./scripts/render/setup.sh
```

This will:

- Check if Render CLI is installed
- Guide you through login
- Validate environment configuration
- Display next steps

## Environment Variables

Configure these in your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Render API Key (from https://dashboard.render.com/account/settings)
export RENDER_API_KEY='your-api-key'

# Deploy Hooks (from service settings → Deploy Hook)
export RENDER_DEPLOY_HOOK_STAGING='https://api.render.com/deploy/srv-xxx'
export RENDER_DEPLOY_HOOK_PRODUCTION='https://api.render.com/deploy/srv-yyy'
```

### Getting These Values

1. **API Key**: Dashboard → Account Settings → API Keys → Create New Key
2. **Deploy Hooks**: Dashboard → Select Service → Settings → Deploy Hook

## Available Scripts

### `setup.sh` - Initial Setup

Configure your local environment for Render development.

```bash
./scripts/render/setup.sh
```

**What it does:**

- Checks Node.js and Render CLI installation
- Guides through Render CLI login
- Validates environment variables
- Tests connectivity to Render API

---

### `deploy.sh` - Deploy to Render

Trigger deployment to staging or production environment.

```bash
# Deploy to staging
./scripts/render/deploy.sh staging

# Deploy to production
./scripts/render/deploy.sh production

# Deploy and wait for completion
./scripts/render/deploy.sh staging --wait

# Deploy with custom timeout
./scripts/render/deploy.sh production --wait --timeout 900
```

**Options:**

- `--wait` - Wait for deployment to complete
- `--timeout SECS` - Timeout in seconds (default: 600)
- `--help` - Show help message

**Environment Variables:**

- `RENDER_DEPLOY_HOOK_STAGING` - Staging deploy hook URL
- `RENDER_DEPLOY_HOOK_PRODUCTION` - Production deploy hook URL
- `RENDER_API_KEY` - Required if using `--wait`

---

### `logs.sh` - View Service Logs

Tail logs from any Render service.

```bash
# View web service logs (last 100 lines)
./scripts/render/logs.sh web

# Follow logs in real-time
./scripts/render/logs.sh gateway --follow

# View more lines
./scripts/render/logs.sh web --lines 500

# View production logs
./scripts/render/logs.sh web --env production --follow
```

**Options:**

- `--lines N` - Number of lines to show (default: 100)
- `--follow` - Follow log output in real-time
- `--env ENV` - Environment (staging|production, default: staging)
- `--help` - Show help message

**Available Services:**

- `web` - Next.js web application
- `gateway` - GraphQL API gateway
- `document-service` - Document management service
- `ai-service` - AI/ML service
- `task-service` - Task management service
- `integration-service` - Third-party integrations
- `notification-service` - Notifications and email

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

---

### `shell.sh` - Open Service Shell

Open interactive shell in a Render service.

```bash
# Open interactive shell
./scripts/render/shell.sh web

# Run a command
./scripts/render/shell.sh gateway --command "npm run db:migrate"

# Production environment
./scripts/render/shell.sh web --env production
```

**Options:**

- `--env ENV` - Environment (staging|production, default: staging)
- `--command CMD` - Command to run (default: interactive shell)
- `--help` - Show help message

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

**Common Commands:**

```bash
# Run database migrations
./scripts/render/shell.sh gateway --command "npm run db:migrate"

# Check environment variables
./scripts/render/shell.sh web --command "env | sort"

# View process info
./scripts/render/shell.sh gateway --command "ps aux"
```

---

### `status.sh` - Check Service Status

Display health status of all Render services.

```bash
# Check staging status
./scripts/render/status.sh

# Check production status
./scripts/render/status.sh --env production

# Verbose output
./scripts/render/status.sh --verbose
```

**Options:**

- `--env ENV` - Environment (staging|production, default: staging)
- `--verbose` - Show detailed information
- `--help` - Show help message

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

**Output:**

- Service health (healthy, deploying, failed)
- Summary of all services
- Links to Render dashboard

---

### `db-backup.sh` - Backup Database

Trigger manual database backup on Render.

```bash
# Backup staging database
./scripts/render/db-backup.sh

# Backup production database
./scripts/render/db-backup.sh --env production

# Specify database name
./scripts/render/db-backup.sh --database postgres --env production
```

**Options:**

- `--env ENV` - Environment (staging|production, default: staging)
- `--database NAME` - Database name (default: postgres)
- `--help` - Show help message

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

**Notes:**

- Render automatically backs up databases daily
- Manual backups are retained for 7 days (Standard plan)
- Use for pre-deployment backups or critical moments

---

### `db-restore.sh` - Restore Database

Restore database from a Render backup.

```bash
# Restore from backup (with confirmation)
./scripts/render/db-restore.sh backup_abc123

# Force restore without confirmation
./scripts/render/db-restore.sh backup_abc123 --force

# Restore production database
./scripts/render/db-restore.sh backup_abc123 --env production --force
```

**Options:**

- `--env ENV` - Environment (staging|production, default: staging)
- `--database NAME` - Database name (default: postgres)
- `--force` - Skip confirmation prompt
- `--help` - Show help message

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

**⚠️ Warning:**

- This operation is **DESTRUCTIVE** and will replace current database
- Always backup current state before restoring
- Use `--force` carefully, especially in production

**Getting Backup ID:**

```bash
# List available backups
render db backups --database postgres
```

---

### `env-sync.sh` - Sync Environment Variables

Sync environment variables from a local .env file to Render services.

```bash
# Sync from default .env file
./scripts/render/env-sync.sh

# Sync from specific file
./scripts/render/env-sync.sh .env.production --env production

# Sync to specific service
./scripts/render/env-sync.sh --service web

# Dry run (preview changes)
./scripts/render/env-sync.sh --dry-run
```

**Options:**

- `--env ENV` - Environment (staging|production, default: staging)
- `--service SVC` - Service to update (default: all services)
- `--dry-run` - Show what would be synced without applying
- `--help` - Show help message

**Environment Variables:**

- `RENDER_API_KEY` - Render API key

**⚠️ Warning:**

- This will overwrite existing environment variables
- Does not delete variables not in the file
- Always use `--dry-run` first to verify changes
- Services may need to be redeployed for changes to take effect

**Workflow:**

```bash
# 1. Preview changes
./scripts/render/env-sync.sh --dry-run

# 2. Apply to staging first
./scripts/render/env-sync.sh --env staging

# 3. Test staging
./scripts/render/deploy.sh staging

# 4. Apply to production
./scripts/render/env-sync.sh --env production

# 5. Deploy production
./scripts/render/deploy.sh production
```

---

## Common Workflows

### Deploy Changes to Staging

```bash
# 1. Check current status
./scripts/render/status.sh

# 2. Deploy to staging
./scripts/render/deploy.sh staging --wait

# 3. View logs
./scripts/render/logs.sh web --follow
```

### Deploy to Production

```bash
# 1. Backup production database
./scripts/render/db-backup.sh --env production

# 2. Deploy to production
./scripts/render/deploy.sh production --wait

# 3. Monitor logs
./scripts/render/logs.sh web --env production --follow

# 4. Check all services
./scripts/render/status.sh --env production
```

### Debug Service Issues

```bash
# 1. Check service status
./scripts/render/status.sh

# 2. View recent logs
./scripts/render/logs.sh gateway --lines 500

# 3. Open shell for investigation
./scripts/render/shell.sh gateway

# 4. Check environment variables
./scripts/render/shell.sh gateway --command "env | grep DATABASE"
```

### Update Environment Variables

```bash
# 1. Update local .env file
vim .env.staging

# 2. Preview changes
./scripts/render/env-sync.sh .env.staging --dry-run

# 3. Apply changes
./scripts/render/env-sync.sh .env.staging --env staging

# 4. Redeploy services
./scripts/render/deploy.sh staging
```

## Troubleshooting

### "Render CLI is not installed"

```bash
npm install -g @render/cli
render login
```

### "RENDER_API_KEY environment variable is not set"

1. Get API key from https://dashboard.render.com/account/settings
2. Add to shell profile:

```bash
echo 'export RENDER_API_KEY="your-key"' >> ~/.zshrc
source ~/.zshrc
```

### "RENDER*DEPLOY_HOOK*\* not set"

1. Go to Render Dashboard
2. Select service
3. Settings → Deploy Hook
4. Copy URL and add to shell profile:

```bash
echo 'export RENDER_DEPLOY_HOOK_STAGING="https://api.render.com/deploy/srv-xxx"' >> ~/.zshrc
source ~/.zshrc
```

### "Failed to trigger backup"

- Verify `RENDER_API_KEY` is set correctly
- Check you have permission to backup databases
- Ensure Render CLI is logged in: `render whoami`

### Services won't start after env-sync

- Verify all required environment variables are set
- Check service logs: `./scripts/render/logs.sh <service-name> --lines 200`
- Redeploy service: `./scripts/render/deploy.sh staging`

## Script Permissions

All scripts must be executable:

```bash
chmod +x scripts/render/*.sh
```

If you get "Permission denied":

```bash
cd /Users/mio/Desktop/dev/Bojin-law\ 2
chmod +x scripts/render/*.sh
```

## Additional Resources

- **Render Documentation**: https://render.com/docs
- **Render CLI Reference**: https://render.com/docs/cli
- **Deployment Guide**: `infrastructure/DEPLOYMENT_GUIDE.md`
- **Operations Runbook**: `infrastructure/OPERATIONS_RUNBOOK.md`
- **Dashboard**: https://dashboard.render.com/

## Support

- **Render Support**: https://render.com/support
- **Team Slack**: #infrastructure channel
- **On-Call**: See `infrastructure/OPERATIONS_RUNBOOK.md`

---

## Script Development

### Adding New Scripts

1. Create script in `scripts/render/`
2. Follow existing script structure:
   - Shebang: `#!/usr/bin/env bash`
   - Error handling: `set -euo pipefail`
   - Help message with `--help` flag
   - Color-coded output
   - Error checking
3. Make executable: `chmod +x scripts/render/new-script.sh`
4. Document in this README
5. Test thoroughly before committing

### Script Template

```bash
#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]
Description of what this script does
EOF
  exit 1
}

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help) usage ;;
    *) log_error "Unknown: $1"; usage ;;
  esac
done

# Main logic here
```
