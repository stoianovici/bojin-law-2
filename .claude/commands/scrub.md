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

1. **Port processes**: 3000 (web), 3005/3006 (word-addin), 4000 (gateway), 4003 (ai-service)
2. **File watchers**: tsx watch, tsx/dist, vite, next dev
3. **Build tools**: turbo, tsc --watch, postcss, esbuild
4. **Background shell tasks**: Any running Claude Code background tasks for dev servers
5. **Caches**: .next, node_modules/.cache, .turbo (prevents EMFILE accumulation)

All patterns are project-specific (matching `bojin-law-2` in the path) to avoid killing system or IDE processes.

---

## Execution Steps

### 1. Kill Port Processes

```bash
lsof -ti:3000,3005,3006,4000,4003 | xargs kill -9 2>/dev/null || true
```

### 2. Kill Orphaned File Watchers and Build Processes

```bash
# Kill all project-related tsx/tsc/node processes (simplified patterns for reliability)
pkill -9 -f "bojin-law-2.*tsx" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*tsc" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*vite" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*next" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*turbo" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*postcss" 2>/dev/null || true
pkill -9 -f "bojin-law-2.*esbuild" 2>/dev/null || true
```

### 3. Kill Background Shell Tasks

Use the KillShell tool to terminate any running background dev server tasks.

### 4. Clean Caches (prevents EMFILE errors)

```bash
# Remove caches that accumulate file watchers
rm -rf apps/web/.next
rm -rf node_modules/.cache
rm -rf .turbo
```

### 5. Verify Cleanup

```bash
# Confirm ports are free
lsof -ti:3000,3005,3006,4000,4003 || echo "All ports free"
```

### 6. Restart Services (if --restart)

If `--restart` flag is provided, start all services with increased file descriptor limit:

```bash
# Increase file limit to prevent EMFILE errors (61440 is macOS default max)
ulimit -n 61440

# Start web + gateway
pnpm dev &

# Start word-addin
pnpm --filter word-addin dev &

# Start ai-service
pnpm --filter ai-service dev &
```

Wait 5 seconds, then verify all services are running.

---

## Output

Report what was cleaned and current status:

```
Scrub complete:
- Killed processes on ports: 3000, 4000, 4003
- Killed 3 orphaned file watchers
- Terminated 2 background shell tasks
- Cleaned caches: .next, node_modules/.cache, .turbo

[If --restart]
Services restarted:
- Web: http://localhost:3000
- Gateway: http://localhost:4000/graphql
- Word Add-in: https://localhost:3005
- AI Service: http://localhost:4003
```

---

## Rules

- ALWAYS kill port processes first
- ALWAYS kill project-specific watchers (not system-wide node processes)
- ALWAYS clean caches (.next, node_modules/.cache, .turbo) to prevent EMFILE buildup
- USE increased file limit (61440, macOS max) when restarting to prevent EMFILE errors
- VERIFY services are running after restart before reporting success
- DO NOT kill VS Code TypeScript server or other IDE processes
