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
pnpm --filter database exec prisma migrate diff \
  --from-migrations-directory packages/database/prisma/migrations \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --exit-code
```

**Exit code 0**: Schema matches migrations. Safe to proceed.
**Exit code 2**: **BLOCK** deploy - schema drift detected:

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

Execute deployment:

```bash
# Use pnpm deploy:production for this project
pnpm deploy:production
```

### 5. Post-deploy Verification

- Check deployment succeeded
- Verify app is accessible
- Report any issues

## Output

```markdown
## Deployment Complete

### Verification

- [x] All checks passed
- [x] Build succeeded
- [x] Deployed to production

### Details

- **URL**: https://...
- **Commit**: abc1234
- **Time**: 2024-12-29 10:30

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
