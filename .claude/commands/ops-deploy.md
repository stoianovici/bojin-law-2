# Deploy to Production

Deploy to Coolify services on Hetzner.

## Input

$ARGUMENTS options:

- (none) - Deploy web only (default)
- `all` - Deploy all services
- `gateway` - Deploy gateway only
- `ai` - Deploy AI service only
- `web gateway` - Deploy specific services

## 1. Pre-flight (Mandatory)

```bash
pnpm preflight:full
```

**If this fails, stop. Fix issues first.**

## 2. Git Checks

```bash
git status
git branch --show-current
```

- Working directory must be clean
- Should be on `main` branch
- Push if ahead of origin

## 3. Deploy

```bash
./scripts/deploy-trigger.sh          # web only (default)
./scripts/deploy-trigger.sh all      # all services
./scripts/deploy-trigger.sh gateway  # gateway only
./scripts/deploy-trigger.sh ai       # ai service only
```

## 4. Monitor

```bash
./scripts/deploy-status.sh           # Check status
./scripts/deploy-status.sh --watch   # Auto-refresh
./scripts/deploy-logs.sh gateway     # View logs
```

## 5. Smoke Test (Mandatory)

After deploy completes (~2-3 min):

```bash
pnpm smoke-test
```

**If smoke test fails, investigate immediately.**

## 6. Report

```
Deployed: {services}
Commit: {hash}
Preflight: ✓
Smoke test: ✓/✗

URLs:
- Web: https://app.bojin-law.com
- Gateway: https://api.bojin-law.com
- Health: https://api.bojin-law.com/health
```

## Coolify Services

| Service    | UUID                       | URL               |
| ---------- | -------------------------- | ----------------- |
| Web        | `fkg48gw4c8o0c4gs40wkowoc` | app.bojin-law.com |
| Gateway    | `t8g4o04gk84ccc4skkcook4c` | api.bojin-law.com |
| AI Service | `a4g08w08cokosksswsgcoksw` | (internal only)   |

## Infrastructure

- **Server**: 135.181.44.197 (Hetzner cx33)
- **Coolify Dashboard**: http://135.181.44.197:8000
- **API Token**: `COOLIFY_API_TOKEN` in `.env.local`
