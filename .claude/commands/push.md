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

### 2. Database Migration Check (CRITICAL)

This prevents schema drift between Prisma schema and production database.

#### Step 2a: Check for uncommitted schema or migration changes

```bash
git status packages/database/prisma/
```

If schema.prisma or migrations/ have uncommitted changes → **BLOCK** push:

```
Schema or migration files have uncommitted changes.
Run /commit first, then /push again.
```

#### Step 2b: Detect schema changes without migrations

```bash
pnpm --filter database exec prisma migrate diff \
  --from-migrations-directory packages/database/prisma/migrations \
  --to-schema-datamodel packages/database/prisma/schema.prisma \
  --exit-code
```

- **Exit code 0**: Schema matches migrations. Safe to proceed.
- **Exit code 2**: Schema has changes not in any migration file. **BLOCK** push:

```
Schema drift detected! schema.prisma has changes not captured in migrations.

Changes detected:
[show the diff output here]

To fix:
1. Create migration: pnpm --filter database exec prisma migrate dev --name <description>
2. Review the generated SQL in packages/database/prisma/migrations/<timestamp>_<description>/
3. Commit the migration: /commit
4. Push again: /push

Without a migration file, production database won't be updated!
```

#### Step 2c: Verify migrations are committed

```bash
# Check for untracked migration files
git status packages/database/prisma/migrations/
```

If untracked migrations exist → **BLOCK** push:

```
Untracked migration files found! These won't be deployed.

Untracked:
  packages/database/prisma/migrations/20260117_xxx/

Run /commit to include migrations, then /push again.
```

#### Step 2d: Show migrations being deployed

```bash
# Find migrations not yet in production (committed after last push)
git log origin/main..HEAD --oneline -- packages/database/prisma/migrations/
```

If migrations found, display:

```
Migrations to deploy:
  20260117100001_fix_tasks_case_id_nullable
  20260117100002_add_client_id_to_document_folders

These will run automatically on container start.
```

### 3. Show What's Being Pushed

Display unpushed commits:

```
Commits to push:
  abc1234 feat(clients): add delete dialog
  def5678 fix(email): handle edge case
```

If no commits to push, abort with message.

### 4. Confirm and Push

```bash
git push origin main
```

### 5. Report Status

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
- **BLOCK push if schema drift detected** (schema.prisma changes without migration)
- **BLOCK push if untracked migrations exist** (they won't be deployed)
- Always show which migrations will be deployed

## Comparison with /deploy

| Feature      | /push  | /deploy  |
| ------------ | ------ | -------- |
| Schema check | Yes    | Yes      |
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
