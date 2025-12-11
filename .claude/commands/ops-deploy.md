# Deploy to Production

Deploy the current code to production after local verification.

## 1. Pre-flight Checks

Run these checks before deploying:

1. **Check git status**:
   - Run `git status`
   - Ensure working directory is clean (no uncommitted changes)
   - If dirty, ask user: "Uncommitted changes detected. Commit first with `/ops-commit`?"

2. **Check current branch**:
   - Run `git branch --show-current`
   - Should be on `main` for production deploys
   - If not on main, warn user

3. **Check if pushed**:
   - Run `git status` to check if ahead of origin
   - If unpushed commits, run `git push` first

## 2. Offer Local Preview

Ask user:

```
Before deploying, would you like to test the production build locally?

- `pnpm preview` - Build and run production Docker locally (recommended)
- Skip and deploy directly

Local preview runs at http://localhost:3000 with production config.
```

If user wants preview:

- Run `pnpm preview`
- Wait for user to verify
- Ask: "Does everything look good? Ready to deploy?"

## 3. Deploy

The user's input is: $ARGUMENTS

**If "staging" specified**:

- Run `pnpm deploy:staging`

**Otherwise (default = production)**:

- Run `pnpm deploy:production`

## 4. Monitor Deployment

1. Show deploy hook response
2. Provide Render dashboard link: https://dashboard.render.com/
3. Note: Deployment typically takes 3-5 minutes

## 5. Verify Deployment

After deploy completes:

1. **Check production URL**:
   - Web: https://legal-platform-web.onrender.com
   - Gateway: https://legal-platform-gateway.onrender.com/health

2. **Run smoke test** (if applicable):
   - Check health endpoints
   - Verify the specific fix/feature is live

## 6. Update Ops Log

If there's an active issue being worked on:

1. Read `docs/ops/operations-log.md`
2. Find the active issue
3. Add to Session Log:
   ```
   - [{timestamp}] Deployed to production
   ```

## 7. Report

```
## Deployment Complete

**Environment**: {production/staging}
**Branch**: {branch}
**Commit**: {hash}
**Status**: Deployed

**URLs**:
- Web: https://legal-platform-web.onrender.com
- API: https://legal-platform-gateway.onrender.com

**Next steps**:
- Verify the deployment at the URLs above
- If issues found, run `/ops-new` to track them
```

## Quick Deploy Shortcuts

- `/ops-deploy` - Deploy to production (default)
- `/ops-deploy staging` - Deploy to staging
- `/ops-deploy --skip-preview` - Skip local preview prompt

## Important Rules

- **Always check for uncommitted changes** before deploying
- **Prefer local preview first** - `pnpm preview` catches issues before they hit production
- **Production deploys are manual only** - No auto-deploy on push
- **Monitor after deploy** - Verify the deployment worked
