# Deploy to Production

Deploy the current code to Render services. This command enforces local verification before deployment.

## 1. MANDATORY Pre-flight Checks

**These checks are NOT optional. Deployment will be blocked if they fail.**

### Step 1: Run Full Parity Check

```bash
pnpm preflight:full
```

This validates:

- TypeScript compilation (same as Docker build)
- ESLint and Prettier
- Unit tests
- Production build
- Docker build
- Dev/prod parity (Node versions, etc.)

**If this fails, STOP. Fix the issues before deploying.**

### Step 2: Check Git Status

```bash
git status
```

- Ensure working directory is clean (no uncommitted changes)
- If dirty, ask user: "Uncommitted changes detected. Commit first with `/ops-commit`?"

### Step 3: Check Current Branch

```bash
git branch --show-current
```

- Should be on `main` for production deploys
- If not on main, warn user

### Step 4: Check if Pushed

```bash
git status
```

- Check if ahead of origin
- If unpushed commits, run `git push` first

## 2. Local Verification (Strongly Recommended)

Before deploying, offer local production testing:

```
Before deploying, I recommend testing the production build locally:

Option 1 - Quick production Docker test:
  pnpm preview
  (Builds and runs production Docker locally at http://localhost:3000)

Option 2 - Skip and deploy directly
  (Only if you're confident the change is safe)

Which would you prefer?
```

If user wants preview:

1. Run `pnpm preview`
2. Wait for user to verify at http://localhost:3000
3. Ask: "Does everything look good? Ready to deploy?"

## 3. Final Pre-Deploy Checklist

Before triggering deploy, show this checklist:

```
## Pre-Deploy Checklist

✓ pnpm preflight:full passed
✓ Working directory clean
✓ On main branch
✓ All changes pushed

Ready to deploy?
```

If any check shows ✗, do not proceed.

## 4. Deploy

The user's input is: $ARGUMENTS

**Deploy commands:**

| Command                                | What it deploys            |
| -------------------------------------- | -------------------------- |
| `pnpm deploy:production`               | Web service only (default) |
| `pnpm deploy:production web`           | Web service only           |
| `pnpm deploy:production gateway`       | Gateway service only       |
| `pnpm deploy:production ai-service`    | AI service only            |
| `pnpm deploy:production legacy-import` | Legacy import only         |
| `pnpm deploy:production all`           | ALL services               |

**Based on user input:**

- No arguments or "production" → `pnpm deploy:production`
- "all" → `pnpm deploy:production all`
- "gateway" → `pnpm deploy:production gateway`
- "web" → `pnpm deploy:production web`
- etc.

## 5. Deploy Hook Configuration

Deploy hooks are stored in `.env.render` (gitignored). The deploy script automatically sources this file.

**If deployment fails with "deploy hook not set":**

1. Check that `.env.render` exists in project root
2. Ensure it contains:
   ```
   RENDER_DEPLOY_HOOK_WEB=https://api.render.com/deploy/srv-...?key=...
   RENDER_DEPLOY_HOOK_GATEWAY=https://api.render.com/deploy/srv-...?key=...
   RENDER_DEPLOY_HOOK_AI_SERVICE=https://api.render.com/deploy/srv-...?key=...
   RENDER_DEPLOY_HOOK_LEGACY_IMPORT=https://api.render.com/deploy/srv-...?key=...
   ```
3. Get hooks from Render Dashboard > Service > Settings > Build & Deploy > Deploy Hook

## 6. Monitor Deployment

1. Show deploy hook response
2. Provide Render dashboard link: https://dashboard.render.com/
3. Note: Deployment typically takes 3-5 minutes

## 7. MANDATORY Post-Deploy Verification

After deploy completes, run smoke test:

```bash
pnpm smoke-test
```

This checks:

- Web app health endpoint
- Web app homepage loads
- Gateway health endpoint
- GraphQL API responds
- Legacy import (if deployed)

**If smoke test fails, investigate immediately.**

## 8. Verify Specific Fix

If deploying for a specific OPS issue:

1. Check the specific functionality that was fixed
2. Verify in production using real data
3. Document verification in the ops log

## 9. Report

```
## Deployment Complete

**Services deployed**: {web/gateway/ai-service/legacy-import/all}
**Branch**: {branch}
**Commit**: {hash}
**Pre-flight**: ✓ Passed
**Smoke test**: {✓ Passed / ✗ Failed}

**URLs**:
- Web: https://legal-platform-web.onrender.com
- Gateway: https://legal-platform-gateway.onrender.com
- Legacy Import: https://bojin-legacy-import.onrender.com

**Verification steps**:
1. ✓ pnpm preflight:full passed
2. ✓ Git clean and pushed
3. ✓ Deploy triggered
4. {✓/✗} Smoke test {passed/failed}
5. { } Manual verification of fix (if applicable)

**Next steps**:
- Verify the deployment at the URLs above
- If issues found, run `/ops-new` to track them
- If fix verified, run `/ops-close` to close the issue
```

## Quick Deploy Shortcuts

- `/ops-deploy` - Deploy web to production (default)
- `/ops-deploy all` - Deploy ALL services
- `/ops-deploy gateway` - Deploy gateway only
- `/ops-deploy web gateway` - Deploy web and gateway

## Render Services

| Service       | URL                                 | Service ID               |
| ------------- | ----------------------------------- | ------------------------ |
| Web           | legal-platform-web.onrender.com     | srv-d4dk9fodl3ps73d3d7ig |
| Gateway       | legal-platform-gateway.onrender.com | srv-d4pkv8q4i8rc73fq3mvg |
| AI Service    | -                                   | srv-d4t77pshg0os73cnebtg |
| Legacy Import | bojin-legacy-import.onrender.com    | srv-d4k84gogjchc73a0lqo0 |

## Important Rules

- **preflight:full is MANDATORY** - Never deploy without it passing
- **Smoke test is MANDATORY** - Always verify after deploy
- **Deploy hooks are in `.env.render`** - This file is gitignored and must exist locally
- **Default deploys only web** - Use `all` to deploy everything
- **Monitor after deploy** - Verify the deployment worked
- **Document in ops log** - If deploying for an issue, update the issue
