# /deploy - Verified Deployment

**Purpose**: Full verification before deploying to production on Coolify/Hetzner.
**Mode**: Autonomous with user confirmation before final deploy

## Auto-load Context (first step, parallel)

```bash
git status                    → Clean working tree?
git log --oneline -3          → What's being deployed
git branch                    → On correct branch?
```

---

## Service Detection (IMPORTANT)

**Only deploy services that have changes.** Determine affected services by checking which paths changed since the last production deploy.

### Path-to-Service Mapping

| Path Pattern           | Service(s) to Deploy                |
| ---------------------- | ----------------------------------- |
| `apps/web/`            | web                                 |
| `apps/mobile/`         | mobile                              |
| `services/gateway/`    | gateway                             |
| `services/ai-service/` | ai-service                          |
| `packages/database/`   | gateway (runs migrations)           |
| `packages/ui/`         | web, mobile (shared UI)             |
| `packages/types/`      | gateway, web, mobile (shared types) |

### How to Detect Changes

Compare current HEAD against what's deployed in production:

```bash
# Get list of changed files since last deploy
# (compare against origin/main which represents production)
git diff --name-only origin/main~1..HEAD
```

Or if deploying a specific commit range:

```bash
git diff --name-only <last-deployed-commit>..HEAD
```

### Determine Services to Deploy

Based on changed files, build the list:

```bash
# Example logic (implement in your analysis):
SERVICES_TO_DEPLOY=()

# Check each path
git diff --name-only origin/main~1..HEAD | while read file; do
  case "$file" in
    apps/web/*) SERVICES_TO_DEPLOY+=(web) ;;
    apps/mobile/*) SERVICES_TO_DEPLOY+=(mobile) ;;
    services/gateway/*) SERVICES_TO_DEPLOY+=(gateway) ;;
    services/ai-service/*) SERVICES_TO_DEPLOY+=(ai-service) ;;
    packages/database/*) SERVICES_TO_DEPLOY+=(gateway) ;;
    packages/ui/*) SERVICES_TO_DEPLOY+=(web mobile) ;;
    packages/types/*) SERVICES_TO_DEPLOY+=(gateway web mobile) ;;
  esac
done

# Deduplicate
SERVICES_TO_DEPLOY=($(echo "${SERVICES_TO_DEPLOY[@]}" | tr ' ' '\n' | sort -u))
```

**If no deployable services detected** (e.g., only docs or scripts changed), inform user and skip deployment.

---

## Prerequisites

- All changes committed (run /commit first if needed)
- On correct branch
- `COOLIFY_API_TOKEN` set in `.env.local`

## Execution Steps

### 1. Pre-deploy Checks (sequential - all must pass)

#### Phase 0: Database Migration Check (CRITICAL)

Prevents schema drift between Prisma schema and production database.

```bash
# Check for uncommitted schema/migration changes
git status packages/database/prisma/

# Detect schema changes not captured in migrations
# Note: Requires shadow database for --from-migrations
pnpm --filter database exec prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres:postgres@localhost:5432/legal_platform_shadow" \
  --exit-code
```

**Exit code 0**: Schema matches migrations. Safe to proceed.
**Exit code 2**: Schema drift detected (changes not in migrations).

Note: Extensions-only diff (pg_trgm, uuid-ossp, vector) is expected and NOT a blocker.

```
Schema drift detected! schema.prisma has changes not captured in migrations.

To fix:
1. Create migration: pnpm --filter database exec prisma migrate dev --name <description>
2. Commit the migration: /commit
3. Deploy again: /deploy
```

Also check for untracked migrations:

```bash
git status packages/database/prisma/migrations/
```

If untracked migrations exist → **BLOCK** deploy (they won't be deployed).

#### Phase 1: Code Quality (parallel)

```bash
pnpm type-check    # TypeScript
pnpm lint          # ESLint
pnpm build         # Production build
```

#### Phase 2: Tests (if available)

```bash
pnpm test          # Unit tests (if configured)
```

#### Phase 3: Build Verification

- Verify build output exists
- Check bundle size is reasonable
- No build warnings that indicate problems

### 2. Handle Failures

Same as /commit:

1. Analyze error
2. Fix automatically
3. Re-run check
4. Max 3 attempts

If unfixable:

- Report issue
- DO NOT deploy
- Ask user for guidance

### 3. Pre-deploy Summary

Show user what will be deployed:

```markdown
## Ready to Deploy

### Checks Passed

- [x] Migration check (no schema drift)
- [x] Type-check
- [x] Lint
- [x] Build
- [x] Tests (or N/A)

### What's Deploying

- **Branch**: main
- **Commit**: abc1234 - feat(auth): add login form
- **Files changed**: 12

### Services to Deploy

Based on changed files, only these services will be deployed:

| Service | Reason                      |
| ------- | --------------------------- |
| gateway | `services/gateway/` changed |
| mobile  | `apps/mobile/` changed      |

**Not deploying**: web, ai-service (no changes)

### Migrations

[List migrations being deployed, or "None" if no new migrations]

Example:

- 20260117100001_fix_tasks_case_id_nullable
- 20260117100002_add_client_id_to_document_folders

These run automatically on container start.

### Confirm?

Reply "deploy" to proceed, or "cancel" to abort.
```

### 4. Deploy (after user confirms)

Push to main and trigger Coolify deploy **only for affected services**:

```bash
# Push to main (if not already pushed)
git push origin main

# Deploy ONLY the services that have changes
# Use the Coolify API directly for each affected service:

COOLIFY_API_TOKEN=$(grep "^COOLIFY_API_TOKEN=" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'")

# Service UUIDs:
# - gateway: t8g4o04gk84ccc4skkcook4c
# - web: fkg48gw4c8o0c4gs40wkowoc
# - mobile: bkgo0ck4kkoo4g04osw8sg8c
# - ai-service: a4g08w08cokosksswsgcoksw

# Example: Deploy only gateway and mobile
curl -s -X POST "http://135.181.44.197:8000/api/v1/deploy?uuid=t8g4o04gk84ccc4skkcook4c" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
curl -s -X POST "http://135.181.44.197:8000/api/v1/deploy?uuid=bkgo0ck4kkoo4g04osw8sg8c" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

**NEVER deploy all services blindly.** Only deploy what changed.

### 5. Monitor Deployment

Check deployment status:

```bash
./scripts/deploy-status.sh
./scripts/deploy-status.sh --watch  # Auto-refresh
```

View logs for a specific service:

```bash
./scripts/deploy-logs.sh gateway   # or: web, ai
./scripts/deploy-logs.sh gateway 200  # Last 200 lines
```

### 6. Post-deploy Verification

- Check all services show ✅ `healthy` status
- Verify https://api.bojin-law.com/health returns OK
- Test https://app.bojin-law.com loads correctly

## Output

```markdown
## Deployment Complete

### Status

./scripts/deploy-status.sh output:

SERVICE STATUS FQDN

---

web ✅ healthy https://app.bojin-law.com
gateway ✅ healthy https://api.bojin-law.com
ai-service ✅ healthy (internal)

### URLs

- Web: https://app.bojin-law.com
- API: https://api.bojin-law.com
- Health: https://api.bojin-law.com/health

### Post-deploy

- [ ] Verify in browser
- [ ] Check error monitoring
```

## Rules

- NEVER deploy with failing checks
- ALWAYS get user confirmation before deploy
- VERIFY build before pushing
- REPORT deployment status
- **BLOCK deploy if schema drift detected** (schema.prisma changes without migration)
- **BLOCK deploy if untracked migrations exist** (they won't be deployed)
- Always show which migrations will be deployed in summary
- **ONLY deploy services with actual changes** - analyze changed files and map to services
- Show user exactly which services will deploy and why (with file paths that triggered it)
- If only non-deployable files changed (docs, scripts, configs), inform user and skip deploy

## Infrastructure Reference

| Service    | Coolify UUID               | Port | Health Endpoint  |
| ---------- | -------------------------- | ---- | ---------------- |
| Web        | `fkg48gw4c8o0c4gs40wkowoc` | 3000 | `/api/health`    |
| Mobile     | `bkgo0ck4kkoo4g04osw8sg8c` | 3002 | `/`              |
| Gateway    | `t8g4o04gk84ccc4skkcook4c` | 4000 | `/health`        |
| AI Service | `a4g08w08cokosksswsgcoksw` | 3002 | `/api/ai/health` |
| PostgreSQL | `fkwgogssww08484wwokw4wc4` | 5432 | -                |
| Redis      | `jok0osgo8w4848cccs4s0o44` | 6379 | -                |

**Coolify Dashboard**: http://135.181.44.197:8000
**Server**: 135.181.44.197 (Hetzner cx33)

## Emergency

If something goes wrong post-deploy:

```bash
# Rollback (revert and redeploy only affected services)
git revert HEAD
git push origin main
# Then redeploy only the services that were affected by the reverted commit

# Restart a specific service via Coolify API
COOLIFY_API_TOKEN=$(grep "^COOLIFY_API_TOKEN=" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'")
curl -X POST "http://135.181.44.197:8000/api/v1/applications/<uuid>/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```
