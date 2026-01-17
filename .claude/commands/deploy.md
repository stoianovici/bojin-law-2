# /deploy - Verified Deployment

**Purpose**: Full verification before deploying to production.
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

Push to main (triggers GitHub Actions → Render deploy):

```bash
git push origin main
```

Or trigger Render deploy directly:

```bash
./scripts/deploy-trigger.sh all
```

### 5. Monitor Deployment

Check deployment status:

```bash
./scripts/deploy-status.sh
```

View logs for a specific service:

```bash
./scripts/deploy-logs.sh gateway   # or: web, ai, legacy
```

### 6. Post-deploy Verification

- Check all services show ✅ `live` status
- Verify https://api.bojin-law.com/health returns OK
- Test https://app.bojin-law.com loads correctly

## Output

```markdown
## Deployment Complete

### Status

./scripts/deploy-status.sh output:

SERVICE STATUS COMMIT MESSAGE
legal-platform-web ✅ live abc1234 feat: add login form
legal-platform-gateway ✅ live abc1234 feat: add login form
legal-platform-ai-service ✅ live abc1234 feat: add login form

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

## Emergency

If something goes wrong post-deploy:

```bash
# Rollback (if needed)
git revert HEAD
git push origin main
```
