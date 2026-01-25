# Legal Platform - Claude Code Context

AI-powered legal case management platform for Romanian law firms with Microsoft 365 integration.

## Quick Start

```bash
# First time setup
docker compose up -d      # Start PostgreSQL + Redis
cp .env.example .env.local # Create config file
# Edit .env.local with your Azure AD + Anthropic credentials
pnpm setup                # Run migrations + create symlinks
```

**Startup Commands:**

| Command             | Use When                                            |
| ------------------- | --------------------------------------------------- |
| `/start`            | Local dev with Coolify production DB (via SSH)      |
| `/start --local-db` | Local dev with Docker PostgreSQL                    |
| `/tunnel`           | Cloudflare tunnel + Coolify DB (Word Add-in, HTTPS) |
| `/staging`          | Final testing before production deploy              |

All commands connect to **Coolify production database** by default via SSH tunnel (port 5433).
Add `--local-db` flag to use local Docker PostgreSQL instead.

**Services:**

- Web: http://localhost:3000
- Gateway: http://localhost:4000
- Tunnel: https://dev.bojin-law.com → localhost:4000
- Database: Coolify via SSH (localhost:5433) or Docker (localhost:5432)

## Domains & Infrastructure

| Domain                 | Points To                          | Purpose              |
| ---------------------- | ---------------------------------- | -------------------- |
| `app.bojin-law.com`    | Hetzner/Coolify (135.181.44.197)   | Production frontend  |
| `api.bojin-law.com`    | Hetzner/Coolify (135.181.44.197)   | Production API       |
| `status.bojin-law.com` | Hetzner/Coolify (135.181.44.197)   | Uptime Kuma          |
| `dev.bojin-law.com`    | Cloudflare Tunnel → localhost:4000 | Local dev with HTTPS |

**Cloudflare Tunnel** is pre-configured. Just run `/tunnel` to start it.

## Production Deployment (Coolify)

Production runs on **Coolify** (self-hosted PaaS) on a Hetzner server.

**Server:** `135.181.44.197` (cx33: 4 cores, 8GB RAM)
**Coolify Dashboard:** http://135.181.44.197:8000

**Services:**
| Service | UUID | Port | Health |
|---------|------|------|--------|
| Gateway | `t8g4o04gk84ccc4skkcook4c` | 4000 | `/health` |
| AI Service | `a4g08w08cokosksswsgcoksw` | 3002 | `/api/ai/health` |
| Web | `fkg48gw4c8o0c4gs40wkowoc` | 3000 | `/api/health` |
| PostgreSQL | `fkwgogssww08484wwokw4wc4` | 5432 | - |
| Redis | `jok0osgo8w4848cccs4s0o44` | 6379 | - |
| Uptime Kuma | `i4kc8ocgcg8wsgcs40w4kswc` | 3001 | `/` |

**Deploying:**

```bash
# Via Coolify API (token in .env.local as COOLIFY_API_TOKEN)
curl -X POST "http://135.181.44.197:8000/api/v1/deploy?uuid=<service-uuid>" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"

# Or manually via Coolify dashboard
```

**API Keys (in `.env.local`):**

- `COOLIFY_API_TOKEN` - Deploy services
- `HETZNER_API_TOKEN` - Server management
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` - DNS management

**SSH Access:**

```bash
ssh root@135.181.44.197
```

**Database:**

- PostgreSQL 16 with pgvector extension
- User: `legal_platform`
- Database: `legal_platform`

**Note:** The `render.yaml` file is kept for documentation only. Production is on Coolify, not Render.

## Production Maintenance

Automated maintenance scripts in `scripts/maintenance/`:

| Script              | Schedule          | Purpose                      |
| ------------------- | ----------------- | ---------------------------- |
| `db-backup.sh`      | Daily 3 AM        | Backup to Cloudflare R2      |
| `db-maintenance.sh` | Sunday 4 AM       | VACUUM ANALYZE + bloat check |
| `verify-backup.sh`  | 1st of month 5 AM | Restore test to temp DB      |

**All scripts send Discord notifications** on success/failure.

### Uptime Monitoring

**Uptime Kuma** runs on Coolify monitoring 5 services:

| Service     | Type     | Endpoint/Connection                       |
| ----------- | -------- | ----------------------------------------- |
| Web App     | HTTP     | `https://app.bojin-law.com/api/health`    |
| Gateway API | HTTP     | `https://api.bojin-law.com/health`        |
| AI Service  | HTTP     | `https://api.bojin-law.com/api/ai/health` |
| PostgreSQL  | Database | `10.0.1.7:5432` (internal)                |
| Redis       | Cache    | `10.0.1.8:6379` (internal)                |

Dashboard: https://status.bojin-law.com
Credentials: admin / BojinLaw2026!

### Setup on Server

```bash
# SSH to server
ssh root@135.181.44.197

# Run setup (copies scripts, installs crons)
cd /path/to/repo
./scripts/maintenance/setup-crons.sh

# Edit environment file with credentials
nano /opt/legal-platform/scripts/.env

# Test backup manually
. /opt/legal-platform/scripts/.env && /opt/legal-platform/scripts/db-backup.sh
```

### Logs

```bash
# View logs on server
tail -f /var/log/legal-platform/backup.log
tail -f /var/log/legal-platform/maintenance.log
tail -f /var/log/legal-platform/verify.log
```

### Manual Commands

```bash
# Trigger backup now
./scripts/maintenance/db-backup.sh

# Run maintenance now
./scripts/maintenance/db-maintenance.sh

# Check deployment status
./scripts/deploy-status.sh --watch
```

## Word Add-in Development

The Word Add-in (`apps/word-addin`) requires HTTPS. Use `/tunnel` for local testing.

**Manifests:**

- `manifest.xml` - Local dev (localhost)
- `manifest.staging.xml` - Local via tunnel (dev.bojin-law.com)
- `manifest.prod.xml` - Production (api.bojin-law.com)

**To debug the add-in locally:**

1. Run `/tunnel`
2. In Word: Insert → My Add-ins → Upload My Add-in → `manifest.staging.xml`
3. The add-in loads from your local gateway via tunnel

## Database Connection

By default, `/start` and `/tunnel` connect directly to the **Coolify production database** via SSH tunnel.

**How it works:**

1. Script establishes SSH tunnel: `localhost:5433 → Coolify PostgreSQL`
2. Sets `DATABASE_URL` to point to the tunnel
3. Your local dev services connect to production data

**To use local Docker PostgreSQL instead:**

```bash
./scripts/start.sh --local-db        # Local dev with Docker DB
./scripts/start.sh --tunnel --local-db  # Tunnel with Docker DB
```

**SSH Access Required:** The script needs SSH access to `root@135.181.44.197`

## Environment Variables

All config lives in `.env.local` at the project root. Required:

```env
# Azure AD - from Azure Portal > App Registrations
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
AZURE_AD_TENANT_ID=xxx
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=xxx  # Same as AZURE_AD_CLIENT_ID
NEXT_PUBLIC_AZURE_AD_TENANT_ID=xxx  # Same as AZURE_AD_TENANT_ID

# Anthropic - from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-xxx
```

Redis is provided by local Docker. PostgreSQL connects to Coolify by default (see "Database Connection" above).

## Project Structure

- `apps/web` - Next.js frontend (App Router, Romanian UI)
- `services/gateway` - Node.js GraphQL API
- `packages/database` - Prisma schema and client
- `packages/ui` - Shared component library

## Key Conventions

- UI text in **Romanian**, code in English
- Use `'use client'` for React client components
- Use `clsx` for conditional classes, Radix UI for primitives
- Use section dividers (`// ====`) to organize code sections

## Development Workflow

```
/ideate [topic]    # Explore + decide
/plan [slug]       # Break into tasks (if complex)
/implement [slug]  # Execute
/test              # Verify
/commit            # Done
```

Quick iterations: `/iterate [description]`

### Bug Workflow

```
/investigate [slug] [symptom]  # Read-only investigation, produces analysis doc
/debug [slug]                  # Fix bug (reads investigation doc if exists)
```

**Rule**: For complex bugs, always `/investigate` first. No code changes until analysis is complete.

### Browser Debugging (MCP)

Claude has direct browser access via Playwright and Chrome DevTools MCP servers. Use automatically when:

- **After UI changes** - Take screenshot to verify visual result
- **Debugging UI bugs** - Inspect console logs, check for errors
- **Performance issues** - Run performance traces, analyze load times
- **Investigating failures** - Check network requests, console errors

**Available tools:**

| Task              | Tool                                                 |
| ----------------- | ---------------------------------------------------- |
| Screenshot        | `browser_take_screenshot`                            |
| Navigate          | `browser_navigate`                                   |
| Click/type        | `browser_click`, `browser_type`                      |
| Console logs      | `browser_console_messages`                           |
| Network           | `browser_network_requests`                           |
| Performance trace | `performance_start_trace` / `performance_stop_trace` |

**No special commands needed** - use these proactively during `/debug`, `/iterate`, or any UI work.

## Testing

```bash
pnpm test             # Unit tests
pnpm test:e2e         # Playwright E2E
pnpm preflight        # All checks before commit
```

## Database

```bash
# Migrations
pnpm --filter database exec prisma migrate deploy

# Push schema changes (dev)
pnpm --filter database exec prisma db push

# Studio (GUI)
pnpm --filter database exec prisma studio
```
