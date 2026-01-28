# /scrub - Deep Clean Dev Environment

**Purpose**: Kill all dev processes and orphaned file watchers, then optionally restart services.
**Mode**: Autonomous
**Input**: Optional `--restart` flag to restart services after cleanup
**Output**: Clean environment with all dev ports freed

## Invocation

```bash
# Just clean up
/scrub

# Clean up and restart all services
/scrub --restart
```

## What Gets Cleaned

1. **Port processes**: All dev ports (3000-3006, 4000, 4003, 5432, 5433)
2. **Tunnels**: SSH tunnel to Coolify, Cloudflare tunnel
3. **ALL project processes**: Any process with `bojin-law-2` in command line (node, pnpm, tsx, tsc, next, vite, etc.)
4. **Background shell tasks**: Any running Claude Code background tasks
5. **Caches**: All .next dirs, node_modules/.cache, .turbo
6. **Stale processes**: Prisma Studio, Playwright, Jest watch, Docker dev containers

Uses project-path matching (`bojin-law-2`) to avoid killing system/IDE processes.

---

## Execution Steps

### 1. Kill All Dev Port Processes

```bash
# Kill all processes on dev ports (comprehensive list)
lsof -ti:3000,3001,3002,3003,3004,3005,3006,4000,4003,5432,5433 | xargs kill -9 2>/dev/null || true
```

### 2. Kill Tunnels

```bash
# Kill SSH tunnel to Coolify (port 5433)
lsof -ti:5433 | xargs kill 2>/dev/null || true

# Kill Cloudflare tunnel
pkill -9 -f "cloudflared" 2>/dev/null || true
```

### 3. Kill ALL Project Processes (Nuclear Option)

```bash
# Kill ALL processes with bojin-law-2 in command line
# This catches everything: node, pnpm, tsx, tsc, next, vite, turbo, etc.
pkill -9 -f "bojin-law-2" 2>/dev/null || true

# Specifically target common orchestrators that might survive
pkill -9 -f "pnpm.*dev" 2>/dev/null || true
pkill -9 -f "turbo.*dev" 2>/dev/null || true
```

### 4. Kill Background Shell Tasks

Use the KillShell tool to terminate any running Claude Code background tasks.

### 5. Kill Test/Dev Tool Processes

```bash
# Jest watch mode
pkill -9 -f "jest.*--watch" 2>/dev/null || true

# Prisma Studio
pkill -9 -f "prisma.*studio" 2>/dev/null || true

# Playwright test servers
pkill -9 -f "@playwright/test" 2>/dev/null || true

# Any stray node inspector/debug processes
pkill -9 -f "node.*--inspect" 2>/dev/null || true
```

### 6. Clean Caches (prevents EMFILE errors)

```bash
# Remove all .next caches
rm -rf apps/*/.next

# Remove build caches
rm -rf node_modules/.cache
rm -rf .turbo
rm -rf apps/word-addin/node_modules/.vite
```

### 7. Stop Docker Dev Containers (optional)

If Docker containers are causing issues or you want a full reset:

```bash
# Stop project Docker containers (postgres, redis)
docker compose down 2>/dev/null || true
```

Skip this step if you want to keep database data between scrubs.

### 8. Verify and Retry (up to 3 times)

Some processes may respawn or survive the first kill. Retry until clean:

```bash
for i in 1 2 3; do
  # Check if any processes remain
  REMAINING_PORTS=$(lsof -ti:3000,3001,3002,3005,3006,4000,4003,5433 2>/dev/null)
  REMAINING_PROCS=$(pgrep -f "bojin-law-2" 2>/dev/null)

  if [ -z "$REMAINING_PORTS" ] && [ -z "$REMAINING_PROCS" ]; then
    echo "All clean on attempt $i"
    break
  fi

  echo "Attempt $i: killing remaining processes..."

  # Kill remaining port processes
  echo "$REMAINING_PORTS" | xargs kill -9 2>/dev/null || true

  # Kill remaining project processes
  echo "$REMAINING_PROCS" | xargs kill -9 2>/dev/null || true

  sleep 1
done

# Final verification
lsof -ti:3000,3001,3002,3005,3006,4000,4003,5433 || echo "All ports free"
pgrep -f "bojin-law-2" || echo "No project processes running"
```

### 9. Restart Services (if --restart)

If `--restart` flag is provided, start all services with increased file descriptor limit:

```bash
# Increase file limit to prevent EMFILE errors (61440 is macOS default max)
ulimit -n 61440

# Start web + gateway + mobile
pnpm dev &

# Start word-addin
pnpm --filter word-addin dev &

# Start ai-service
pnpm --filter ai-service dev &

# Start mobile
pnpm --filter mobile dev &
```

Wait 5 seconds, then verify all services are running.

---

## Output

Report what was cleaned and current status:

```
Scrub complete:
- Killed processes on ports: 3000, 3002, 4000, 4003, 5433
- Killed tunnels: SSH, Cloudflare
- Killed X project processes (node, pnpm, tsx, next, etc.)
- Terminated Y background shell tasks
- Cleaned caches: apps/*/.next, node_modules/.cache, .turbo, .vite
- All clean on attempt N (retried if needed)
- All ports verified free ✓
- No project processes remaining ✓

[If --restart]
Services restarted:
- Web: http://localhost:3000
- Mobile: http://localhost:3002
- Gateway: http://localhost:4000/graphql
- Word Add-in: https://localhost:3005
- AI Service: http://localhost:4003
```

---

## Rules

- ALWAYS kill port processes first (catches services regardless of how started)
- ALWAYS use nuclear option `pkill -9 -f "bojin-law-2"` to catch ALL project processes
- ALWAYS retry up to 3 times - processes may respawn or survive first kill
- ALWAYS clean all caches to prevent EMFILE buildup
- ALWAYS verify with `pgrep -f "bojin-law-2"` that nothing remains
- USE increased file limit (61440) when restarting
- The `pkill -f "bojin-law-2"` pattern is safe because:
  - It only matches processes with project path in command line
  - VS Code/Cursor extensions don't have project path in their command
  - IDE TypeScript servers run from different paths
