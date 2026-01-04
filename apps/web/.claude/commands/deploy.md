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

- [x] Type-check
- [x] Lint
- [x] Build
- [x] Tests (or N/A)

### What's Deploying

- **Branch**: main
- **Commit**: abc1234 - feat(auth): add login form
- **Files changed**: 12

### Confirm?

Reply "deploy" to proceed, or "cancel" to abort.
```

### 4. Deploy (after user confirms)

Execute deployment:

```bash
# For bojin-law-ui (Next.js on Vercel/similar)
# Adjust based on actual deployment setup

git push origin main        # If auto-deploy is configured
# OR
pnpm deploy                 # If custom deploy script exists
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

## Emergency

If something goes wrong post-deploy:

```bash
# Rollback (if needed)
git revert HEAD
git push origin main
```

## Related

- bojin-law-2 has staging/production separation via scripts/render/deploy.sh
- Consider similar setup for bojin-law-ui when ready
