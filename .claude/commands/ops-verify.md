# Verify Local-Production Parity

Run comprehensive verification to ensure local environment matches production. Use this before deploying or when debugging "works locally, fails in prod" issues.

## Input

The user's input is: $ARGUMENTS

Options:

- `quick` - Fast checks only (parity + preflight:quick)
- `full` - Full verification including Docker build (DEFAULT)
- `prod-data` - Verify with production data connection
- `docker` - Run full production Docker locally

## 1. Quick Parity Check

Run the parity check script:

```bash
pnpm check-parity
```

This validates:

- Node.js version consistency (Dockerfiles + CI)
- pnpm version alignment
- Docker Compose file validity
- Dockerfile structure
- Environment variable templates

**Report results:**

```
## Parity Check Results

✓ Node.js: All versions match (22)
✓ pnpm: Version matches (10.x)
✓ Docker Compose: Valid structure
✓ Dockerfiles: Valid structure
✓ Environment: Templates exist
```

## 2. Preflight Verification

Based on input, run appropriate preflight:

**For `quick`:**

```bash
pnpm preflight:quick
```

**For `full` (default):**

```bash
pnpm preflight:full
```

This validates:

- TypeScript compilation (same as Docker build)
- ESLint and Prettier
- Unit tests
- Production build (`pnpm build`)
- Docker build (full only)

**Report results:**

```
## Preflight Results

✓ TypeScript: Compiles without errors
✓ ESLint: No errors
✓ Prettier: Formatted correctly
✓ Tests: All passing
✓ Build: Production build successful
✓ Docker: Image builds successfully (full only)
```

## 3. Environment Comparison

Compare local environment to production:

```
## Environment Comparison

| Variable          | Local (.env.prod) | Production (Render) | Match |
| ----------------- | ----------------- | ------------------- | ----- |
| DATABASE_URL      | ✓ Set             | ✓ Set               | ✓     |
| REDIS_URL         | ✓ Set             | ✓ Set               | ✓     |
| ANTHROPIC_API_KEY | ✓ Set             | ✓ Set               | ✓     |
| ...               | ...               | ...                 | ...   |

Note: Can't verify actual Render values - check dashboard if issues occur.
```

## 4. Production Data Test (if `prod-data`)

If user specified `prod-data`:

```bash
# Test database connection
source .env.prod && pnpm -C services/gateway exec prisma db pull --print
```

**Report:**

```
## Production Data Connection

✓ Database: Connected to production PostgreSQL
✓ Schema: Matches local Prisma schema
✓ Data: {X} cases, {Y} users, {Z} documents
```

## 5. Docker Production Test (if `docker`)

If user specified `docker`:

```bash
pnpm preview
```

Wait for services to start, then:

```bash
# Test health endpoints
curl -s http://localhost:3000/api/health
curl -s http://localhost:4000/health
```

**Use Playwright MCP for automated UI verification:**

After health checks pass, use Playwright MCP to verify the UI:

```
Use playwright mcp to:
1. Navigate to http://localhost:3000
2. Take a screenshot of the homepage
3. Check for any console errors
4. Verify the page loaded correctly
```

This allows you to visually verify the application without requiring the user to manually check.

**Report:**

```
## Docker Production Test

Starting production Docker environment...

✓ Web: http://localhost:3000 - Healthy
✓ Gateway: http://localhost:4000 - Healthy
✓ All services started successfully

### Automated UI Verification (via Playwright MCP)
✓ Homepage loads correctly
✓ No console errors detected
✓ Key UI elements present
[Screenshot captured and reviewed]

To test manually:
- Open http://localhost:3000 in browser
- Check specific functionality

Stop with: Ctrl+C or `docker compose -f infrastructure/docker/docker-compose.prod.yml down`
```

## 6. Known Differences

Always remind about intentional differences:

```
## Known Local vs Production Differences

These are INTENTIONAL and documented:

| Aspect              | Local                     | Production          |
| ------------------- | ------------------------- | ------------------- |
| Database migrations | Manual (`prisma migrate`) | Auto-run at startup |
| Auth validation     | SKIP_AUTH_VALIDATION=true | Always validated    |
| Redis               | Optional (memory fallback)| Required            |
| Azure AD redirect   | localhost:3000            | Render URL          |

If your issue involves these areas, you may need to deploy to verify.
```

## 7. Recommendations

Based on results, provide recommendations:

```
## Recommendations

{If all checks pass}:
✓ Local environment matches production
✓ Safe to deploy with confidence

{If parity check fails}:
✗ Parity issues found - fix before deploying
  Run: pnpm check-parity (to see details)

{If preflight fails}:
✗ Code issues found - fix before deploying
  Common fixes:
  - TypeScript errors: Check the error output
  - Test failures: Run `pnpm test` for details
  - Docker build: Check Dockerfile and dependencies

{If debugging "works locally, fails in prod"}:
Suggested investigation:
1. Run `/ops-investigate` with symptom description
2. Check Render logs: `pnpm logs:api` or `pnpm logs:web`
3. Compare env vars in Render dashboard to .env.prod
```

## 8. Summary Report

```
## Verification Summary

| Check            | Status | Details                        |
| ---------------- | ------ | ------------------------------ |
| Parity           | ✓/✗    | {pass/fail details}            |
| TypeScript       | ✓/✗    | {pass/fail details}            |
| Tests            | ✓/✗    | {pass/fail details}            |
| Build            | ✓/✗    | {pass/fail details}            |
| Docker           | ✓/✗/⊘  | {pass/fail/skipped}            |
| Prod Data        | ✓/✗/⊘  | {pass/fail/skipped}            |

**Overall**: {READY TO DEPLOY / ISSUES FOUND}

{If ready}:
  To deploy: `/ops-deploy`

{If issues}:
  Fix the issues above, then run `/ops-verify` again.
```

## Quick Verification Shortcuts

- `/ops-verify` - Full verification (default)
- `/ops-verify quick` - Fast checks only
- `/ops-verify prod-data` - Test production database connection
- `/ops-verify docker` - Run production Docker locally

## Important Rules

- **Run before every deployment** - Catch issues before they reach production
- **Use `full` for important deploys** - Docker build catches most issues
- **Use `quick` for rapid iteration** - Faster feedback loop
- **Check known differences** - Some things can't be tested locally
- **Document failures** - Update pattern library if new issue type found
