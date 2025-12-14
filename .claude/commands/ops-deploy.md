# Deploy to Production

Deploy the current code to Render services.

## 1. Pre-flight Checks

Run these checks before deploying:

1. **Run parity check**:
   - Run `pnpm check-parity`
   - This validates dev/production alignment (Node versions, Dockerfiles, etc.)
   - If it fails, fix the issues before deploying

2. **Check git status**:
   - Run `git status`
   - Ensure working directory is clean (no uncommitted changes)
   - If dirty, ask user: "Uncommitted changes detected. Commit first with `/ops-commit`?"

3. **Check current branch**:
   - Run `git branch --show-current`
   - Should be on `main` for production deploys
   - If not on main, warn user

4. **Check if pushed**:
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

## 4. Deploy Hook Configuration

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

## 5. Monitor Deployment

1. Show deploy hook response
2. Provide Render dashboard link: https://dashboard.render.com/
3. Note: Deployment typically takes 3-5 minutes

## 6. Verify Deployment

After deploy completes:

1. **Check production URLs**:
   - Web: https://legal-platform-web.onrender.com
   - Gateway: https://legal-platform-gateway.onrender.com/health
   - AI Service: Check Render dashboard
   - Legacy Import: https://bojin-legacy-import.onrender.com

2. **Run smoke test** (if applicable):
   - Check health endpoints
   - Verify the specific fix/feature is live

## 7. Report

```
## Deployment Complete

**Services deployed**: {web/gateway/ai-service/legacy-import/all}
**Branch**: {branch}
**Commit**: {hash}
**Status**: Deployed

**URLs**:
- Web: https://legal-platform-web.onrender.com
- Gateway: https://legal-platform-gateway.onrender.com
- Legacy Import: https://bojin-legacy-import.onrender.com

**Next steps**:
- Verify the deployment at the URLs above
- If issues found, run `/ops-new` to track them
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

- **Always check for uncommitted changes** before deploying
- **Deploy hooks are in `.env.render`** - this file is gitignored and must exist locally
- **Default deploys only web** - use `all` to deploy everything
- **Monitor after deploy** - Verify the deployment worked
