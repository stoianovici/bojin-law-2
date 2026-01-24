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

Push to main and trigger Coolify deploy:

```bash
# Push to main
git push origin main

# Trigger Coolify deploy for all services
./scripts/deploy-trigger.sh all
```

Or deploy individual services:

```bash
./scripts/deploy-trigger.sh gateway
./scripts/deploy-trigger.sh web
./scripts/deploy-trigger.sh ai
```

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

## Infrastructure Reference

| Service    | Coolify UUID               | Port | Health Endpoint  |
| ---------- | -------------------------- | ---- | ---------------- |
| Web        | `fkg48gw4c8o0c4gs40wkowoc` | 3000 | `/api/health`    |
| Gateway    | `t8g4o04gk84ccc4skkcook4c` | 4000 | `/health`        |
| AI Service | `a4g08w08cokosksswsgcoksw` | 3002 | `/api/ai/health` |
| PostgreSQL | `fkwgogssww08484wwokw4wc4` | 5432 | -                |
| Redis      | `jok0osgo8w4848cccs4s0o44` | 6379 | -                |

**Coolify Dashboard**: http://135.181.44.197:8000
**Server**: 135.181.44.197 (Hetzner cx33)

## Emergency

If something goes wrong post-deploy:

```bash
# Rollback (revert and redeploy)
git revert HEAD
git push origin main
./scripts/deploy-trigger.sh all

# Or restart a specific service via Coolify API
curl -X POST "http://135.181.44.197:8000/api/v1/applications/<uuid>/restart" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```
