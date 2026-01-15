# /push - Push to Production

**Purpose**: Push local database state to production.
**Mode**: Autonomous with explicit confirmation
**Danger Level**: HIGH - overwrites production data

## When to Use

- After testing changes locally, ready to go live
- Deploying a new database state to production
- Syncing local fixes to production

## Safety Features

1. **Auto-backup**: Production is backed up before any changes
2. **Comparison view**: Shows local vs production counts before push
3. **Explicit confirmation**: Must type "PUSH TO PRODUCTION" to proceed
4. **Rollback path**: Backup file location provided for recovery

## Execution Steps

### 1. Pre-flight Checks

```bash
# Verify Docker and local database
docker info > /dev/null 2>&1
docker ps | grep -E 'legal.*postgres'
```

### 2. Show Comparison

Display side-by-side comparison:
- Users, Clients, Cases, Emails, Tasks, Documents
- Local counts vs Production counts

### 3. Run Push Script

```bash
pnpm push:prod:confirm
```

This will:
1. Backup production database (saved to `backups/`)
2. Export local database
3. Drop all production tables
4. Import local dump to production
5. Verify the push succeeded

### 4. Report Results

Show what was pushed and backup location.

## Output

```markdown
## Push to Production Complete

### What Changed
- Production now matches local database
- Users: X
- Cases: X
- Emails: X

### Backup Created
File: `backups/prod-backup-before-push-YYYYMMDD-HHMMSS.sql.gz`

### To Rollback
If something went wrong:
```bash
gunzip -c backups/prod-backup-before-push-YYYYMMDD-HHMMSS.sql.gz | psql $PROD_DATABASE_URL
```

### Notes
- Users may need to re-login (sessions invalidated)
- Email sync will resume from current state
```

## Rules

- ALWAYS backup production first (unless explicitly skipped)
- ALWAYS show comparison before pushing
- REQUIRE explicit "PUSH TO PRODUCTION" confirmation
- NEVER run without user understanding the consequences
- REPORT backup location for rollback

## Variants

```bash
pnpm push:prod           # Interactive (safest)
pnpm push:prod:confirm   # Skip confirmation prompt
pnpm push:prod:dry-run   # Show what would happen
```

## Related

- To pull production to local: `/sync`
- To switch local databases: `pnpm db:use:seed` or `pnpm db:use:prod`
