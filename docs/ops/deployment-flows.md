# Deployment Flows

> Standard procedures for deploying changes with confidence.
> These flows exist to prevent the "works locally, breaks in prod" problem.

## TL;DR - Before You Push

```bash
pnpm preflight        # Full check (includes Docker build)
# or
pnpm preflight:quick  # Fast check (skips Docker)
```

After deploy:

```bash
pnpm smoke-test       # Verify production
pnpm smoke-test:staging  # Verify staging
```

---

## Why This Matters

Historical issue: Changes that worked locally broke in production because:

- **Dockerfile used pre-built `dist/` from git** instead of compiling fresh
- **Local dev runs TypeScript directly** but Docker runs compiled JS
- **Environment variables behave differently** (Redis URL parsing, etc.)
- **Real service data has edge cases** not present locally

See OPS-001 for a case study: 9 sessions over 3 days to fix email sync, with each issue only appearing after deployment.

---

## The Deployment Flow

### 1. Before Pushing: Preflight Check

Run locally before pushing to ensure your changes will work in production:

```bash
pnpm preflight
```

This runs:

1. **TypeScript compilation** - Same as production build
2. **ESLint** - Code quality
3. **Prettier** - Formatting
4. **Unit tests** - Basic functionality
5. **Production build** - `pnpm build`
6. **Docker build** - Exact same process as Render

Options:

- `pnpm preflight:quick` - Skip Docker build (faster, for rapid iteration)
- `pnpm preflight:fix` - Auto-fix formatting then check

### 2. After Deploying: Smoke Test

Verify critical paths are working after deployment:

```bash
# Production
pnpm smoke-test

# Staging
pnpm smoke-test:staging

# Local (for testing the script)
SMOKE_TEST_WEB_URL=http://localhost:3000 pnpm smoke-test
```

This checks:

- Web app health endpoint
- Web app homepage loads
- Gateway health endpoint
- GraphQL API responds
- Legacy import (if deployed)

### 3. If Something Breaks

1. Check the smoke test output for which endpoint failed
2. Check Render logs: `pnpm logs:web` or `pnpm logs:api`
3. Create an issue in `docs/ops/issues/ops-XXX.md`
4. Document the fix for future reference

---

## Key Architecture Decisions

### Dockerfiles Compile Fresh (No Pre-built dist/)

**Before (problematic):**

- `packages/database/dist/` was committed to git
- Dockerfile copied pre-built JS files
- Fixes to TypeScript source weren't deployed

**After (current):**

- `packages/database/dist/` is gitignored
- Dockerfile runs `pnpm exec tsc` to compile fresh
- Local changes always match production

### Local Dev vs Production

| Aspect     | Local (`pnpm dev`)            | Production (Docker)        |
| ---------- | ----------------------------- | -------------------------- |
| TypeScript | Runs directly via ts-node/tsx | Compiled to JS             |
| Database   | localhost:5432                | Render PostgreSQL          |
| Redis      | localhost:6379                | Render Redis (URL parsing) |
| MS Graph   | Often mocked/skipped          | Real API with edge cases   |

Use `pnpm dev:prod` to run production Docker builds locally for testing.

---

## Scripts Reference

| Script                    | Purpose                               |
| ------------------------- | ------------------------------------- |
| `pnpm preflight`          | Full pre-push validation              |
| `pnpm preflight:quick`    | Fast check (no Docker)                |
| `pnpm preflight:fix`      | Auto-fix then check                   |
| `pnpm smoke-test`         | Post-deploy verification (production) |
| `pnpm smoke-test:staging` | Post-deploy verification (staging)    |
| `pnpm dev:prod`           | Run production Docker locally         |
| `pnpm deploy:staging`     | Trigger staging deploy                |
| `pnpm deploy:production`  | Trigger production deploy             |
| `pnpm logs:web`           | Stream web app logs                   |
| `pnpm logs:api`           | Stream gateway logs                   |

---

## For Future Claude Instances

When working on this codebase:

1. **Always run `pnpm preflight:quick` before suggesting deployment**
2. **If a user reports "works locally, breaks in prod":**
   - First check if they ran preflight
   - Check if the issue is environment-related (Redis, MS Graph, etc.)
   - Document the fix in an ops issue
3. **After any deployment, suggest running `pnpm smoke-test`**
4. **Docker builds compile TypeScript fresh** - don't commit `dist/` to git

The goal is to catch issues BEFORE deployment, not after.
