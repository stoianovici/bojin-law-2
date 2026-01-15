# /push - Push to Production

**Purpose**: Push code changes to production (git push triggers deploy).
**Mode**: Autonomous with confirmation
**Safety**: Code + schema migrations only. NO database data is touched.

## When to Use

- Quick push when you're confident in the changes
- After local testing, ready to deploy
- For full verification workflow, use `/deploy` instead

## What Gets Deployed

| Component         | Deployed? | How                                 |
| ----------------- | --------- | ----------------------------------- |
| Code changes      | Yes       | Git push triggers Render deploy     |
| Schema migrations | Yes       | Auto-run on container start         |
| Database data     | **NO**    | Production data stays untouched     |
| Redis queues      | **NO**    | Each environment has separate Redis |

## Execution Steps

### 1. Pre-flight Checks

```bash
git status              # Clean working tree?
git branch              # On main branch?
git log origin/main..HEAD --oneline  # What's being pushed
```

### 2. Show What's Being Pushed

Display unpushed commits:

```
Commits to push:
  abc1234 feat(clients): add delete dialog
  def5678 fix(email): handle edge case
```

If no commits to push, abort with message.

### 3. Confirm and Push

```bash
git push origin main
```

### 4. Report Status

```markdown
## Push Complete

**Pushed**: 2 commits to origin/main
**Deploy**: Render will auto-deploy from main branch

### What Happens Next

1. Render detects push and starts build
2. Docker image built with new code
3. Migrations run on container start
4. New containers replace old ones

### Monitor

- Render Dashboard: https://dashboard.render.com
- Health check: https://legal-platform-gateway.onrender.com/health
```

## Rules

- ONLY push code (git push)
- NEVER sync database data to production
- REQUIRE clean working tree (commit first)
- PREFER main branch (warn if on feature branch)

## Comparison with /deploy

| Feature      | /push  | /deploy  |
| ------------ | ------ | -------- |
| Type check   | No     | Yes      |
| Lint         | No     | Yes      |
| Build test   | No     | Yes      |
| Unit tests   | No     | Yes      |
| Confirmation | Simple | Detailed |
| Speed        | Fast   | Thorough |

Use `/push` for quick deploys, `/deploy` for verified releases.

## Related

- `/deploy` - Full verification before deploy
- `/sync` - Pull production data to local (safe direction)
- `/commit` - Commit changes before pushing
