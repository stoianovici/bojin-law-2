# /sync - Production Mirror

**Purpose**: Create a local snapshot of production database for debugging.
**Mode**: Autonomous (Claude handles everything, reports result)

## When to Use

- Debugging user-reported issues
- Need to see exactly what user sees
- Investigating production data state

## Execution Steps

### 1. Pre-flight Checks

```bash
# Verify Docker is running
docker info > /dev/null 2>&1

# Verify local postgres container exists
docker ps | grep -E 'legal.*postgres'
```

If Docker not running → ask user to start Docker Desktop.

### 2. Run Mirror Script

```bash
pnpm mirror:prod:confirm
```

This will:
- Export production database from Render
- Drop local `legal_platform_prod` database
- Import production dump
- Clean sync artifacts (EmailSyncState, GraphSubscription, etc.)
- Flush Redis cache
- Switch local env to use `legal_platform_prod`

### 3. Verify Database Switch

**IMPORTANT**: The switch-db.sh script may fail silently if the original database name was `legal_platform` (without suffix).

Check that all env files point to `legal_platform_prod`:

```bash
grep DATABASE_URL packages/database/.env
```

If it still shows `legal_platform` (not `legal_platform_prod`), fix manually:

```bash
sed -i '' 's|legal_platform$|legal_platform_prod|' .env.local .env packages/database/.env services/gateway/.env
```

Verify the database has the expected data:

```bash
docker exec legal-postgres psql -U postgres -d legal_platform_prod -c "SELECT COUNT(*) FROM cases;"
```

### 4. Report Results

Show summary of what was synced:
- User count
- Client count
- Case count
- Email count

## Output

```markdown
## Production Mirror Complete

### Data Synced
- Users: X
- Clients: X
- Cases: X
- Emails: X
- Tasks: X
- Documents: X (metadata only)

### Cleaned Artifacts
- EmailSyncState: delta tokens reset
- GraphSubscription: webhook registrations deleted
- Redis: cache flushed

### Now Using
Database: `legal_platform_prod`

### Notes
- Email/document files are metadata only (actual files in prod)
- Graph API calls will fail locally (no MS365 connection)
- This is for READ-ONLY debugging

### To Switch Back
Run: `pnpm db:use:seed`
```

## Rules

- NEVER run against production (script has safety checks)
- ALWAYS wait for export to complete before reporting
- WARN user this contains real production data
- REPORT exact counts after sync

## Requirements

- `PROD_DATABASE_URL` must be set in `.env.local`
- Docker must be running with postgres container
- `pg_dump` must be available

## Related

- To switch back to seed data: `pnpm db:use:seed`
- To check current database: `pnpm db:which`
