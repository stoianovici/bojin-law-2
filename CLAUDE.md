# Legal Platform - Claude Code Context

AI-powered legal case management platform for Romanian law firms with Microsoft 365 integration.

## ⛔ CRITICAL: Database Safety Rules

> **WARNING**: `localhost:5433` is the SSH tunnel to **PRODUCTION** Coolify database, NOT a dev database.
> On 2026-02-02, a `prisma db push --force-reset` command wiped all production data.

**NEVER run these commands:**

```bash
# FORBIDDEN - These will destroy production data:
prisma db push --force-reset
prisma migrate reset
prisma db push --accept-data-loss
DROP TABLE / TRUNCATE TABLE / DELETE FROM (without WHERE)
```

**Safe alternatives:**

```bash
# For schema changes, use migrations:
pnpm --filter database exec prisma migrate dev --name descriptive_name

# For local-only destructive operations, use --local-db flag:
./scripts/start.sh --local-db  # Then run destructive commands safely
```

**Before ANY database command:**

1. Check which database you're connected to (`localhost:5432` = Docker, `localhost:5433` = PRODUCTION)
2. If connected to port 5433, **ASK THE USER** before running schema changes
3. Never assume the SSH-tunneled database is "development" - it's production

## ⛔ CRITICAL: macOS Cache Safety Rules

> **WARNING**: On 2026-02-10, aggressive cache clearing caused full deauthentication from all services,
> requiring a complete macOS setup process.

**NEVER delete these directories:**

```bash
# FORBIDDEN - These contain authentication tokens:
~/Library/*/Cookies/
~/Library/*/WebKit/
~/Library/Keychains/
~/Library/Accounts/
~/Library/Application Support/Microsoft/

# FORBIDDEN - Broad find patterns on ~/Library:
find ~/Library -name "*cache*" -exec rm -rf {} \;
find ~/Library -name "*Cache*" -exec rm -rf {} \;
```

**Safe alternatives for Office add-in cache issues:**

```bash
# SAFE - Only delete specific add-in folders:
rm -rf ~/Library/Containers/com.microsoft.Outlook/Data/Documents/wef/
rm -rf ~/Library/Group\ Containers/UBF8T346G9.Office/WEF/
rm -rf ~/Library/Group\ Containers/UBF8T346G9.Office/OfficeWebAddinCache/

# NEVER delete Caches/, Cookies/, or WebKit/ directories
```

**Before ANY ~/Library deletion:**

1. Never use `find -exec rm -rf` on ~/Library
2. Never delete directories named Cookies, WebKit, Keychains, or Accounts
3. Only delete specific, named cache folders for the problem you're solving
4. **ASK THE USER** before deleting anything in ~/Library outside of app-specific folders

## ⛔ CRITICAL: Background Task Rules

> **WARNING**: On 2026-02-11, background commands to restart dev servers hung for 9+ minutes,
> appearing to work while doing nothing (exit code 137 = killed/OOM).

**NEVER run these as background tasks:**

- Dev server restarts (`pnpm dev`, `./scripts/start.sh`)
- Long-running processes you need to wait for
- Commands that may get OOM-killed

**Instead:**

- Run dev server commands in **foreground** with explicit timeouts
- If a background task is needed, check its status within 30 seconds
- Exit code 137 = process was killed (SIGKILL) - don't keep waiting

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
- Mobile: http://localhost:3002
- Gateway: http://localhost:4000
- Tunnel (API): https://dev.bojin-law.com → localhost:4000
- Tunnel (Mobile): https://m-dev.bojin-law.com → localhost:3002
- Database: Coolify via SSH (localhost:5433) or Docker (localhost:5432)

## Domains & Infrastructure

| Domain                 | Points To                          | Purpose                            |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| `app.bojin-law.com`    | Hetzner/Coolify (135.181.44.197)   | Desktop frontend                   |
| `m.bojin-law.com`      | Hetzner/Coolify (135.181.44.197)   | Mobile frontend                    |
| `api.bojin-law.com`    | Hetzner/Coolify (135.181.44.197)   | Production API                     |
| `status.bojin-law.com` | Hetzner/Coolify (135.181.44.197)   | Uptime Kuma                        |
| `import.bojin-law.com` | Hetzner/Coolify (135.181.44.197)   | Legacy Import tool                 |
| `dev.bojin-law.com`    | Cloudflare Tunnel → localhost:4000 | Local API dev (HTTPS)              |
| `m-dev.bojin-law.com`  | Cloudflare Tunnel → localhost:3002 | Local mobile dev (phone debugging) |

Mobile users on `app.bojin-law.com` are auto-redirected to `m.bojin-law.com` via Cloudflare Worker.

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
| Web (Desktop) | `fkg48gw4c8o0c4gs40wkowoc` | 3000 | `/api/health` |
| Mobile | `bkgo0ck4kkoo4g04osw8sg8c` | 3002 | `/api/health` |
| Legacy Import | `ys0ok48o0gccs4s8wcoogcw8` | 3001 | `/api/health` |
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

```
bojin-law-2/
├── apps/
│   ├── web/           # Desktop app (app.bojin-law.com)
│   ├── mobile/        # Mobile app (m.bojin-law.com) - NEW
│   └── word-addin/    # Microsoft Word Add-in
├── services/
│   └── gateway/       # GraphQL API (api.bojin-law.com)
└── packages/
    └── database/      # Prisma schema and client
```

## Apps

| App             | Path              | Domain              | Purpose                     |
| --------------- | ----------------- | ------------------- | --------------------------- |
| **Desktop**     | `apps/web`        | `app.bojin-law.com` | Full-featured web app       |
| **Mobile**      | `apps/mobile`     | `m.bojin-law.com`   | Focused mobile experience   |
| **Word Add-in** | `apps/word-addin` | —                   | Document generation in Word |

**When starting a session**, specify which app you're working on:

- "working on mobile" → Read `apps/mobile/CLAUDE.md` for mobile context
- "working on desktop" → Focus on `apps/web`, ignore mobile
- "working on gateway" → Focus on `services/gateway`

Each app is **independently deployable**. Desktop and mobile share the same gateway API but have separate Coolify services and deploy triggers.

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

> **Remember**: By default you're connected to PRODUCTION via SSH tunnel (port 5433).
> See "Database Safety Rules" at the top of this file.

```bash
# Apply existing migrations (safe for production)
pnpm --filter database exec prisma migrate deploy

# Create new migration (generates SQL, doesn't run destructive ops)
pnpm --filter database exec prisma migrate dev --name descriptive_name

# Studio (GUI) - safe, read-only by default
pnpm --filter database exec prisma studio

# DANGEROUS - only use with --local-db flag:
# prisma db push (can cause data loss on schema conflicts)
```
