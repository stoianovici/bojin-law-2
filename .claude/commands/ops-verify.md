# Verify Local-Production Parity

Comprehensive verification before deploying or debugging "works locally, fails in prod" issues.

## Input

$ARGUMENTS options:

- `quick` - Fast checks only
- `full` - Full verification including Docker (DEFAULT)
- `ui` - Use Playwright MCP to test UI

## 1. Run Checks

**Quick mode:**

```bash
pnpm check-parity && pnpm preflight:quick
```

**Full mode (default):**

```bash
pnpm check-parity && pnpm preflight:full
```

## 2. UI Testing (if `ui` or `docker`)

Use Playwright MCP for automated browser testing:

```
Use playwright mcp to:
1. Navigate to http://localhost:3000
2. Take a screenshot
3. Check console for errors
4. Test specific functionality
```

This is for visual verification - use it when you need to see what the user sees.

## 3. Report Results

```
## Verification Results

| Check       | Status |
|-------------|--------|
| Parity      | ✓/✗    |
| TypeScript  | ✓/✗    |
| Tests       | ✓/✗    |
| Build       | ✓/✗    |
| Docker      | ✓/✗/⊘  |
| UI (Playwright) | ✓/✗/⊘ |

**Result**: READY TO DEPLOY / ISSUES FOUND
```

## Known Local vs Prod Differences

| Aspect        | Local                      | Production       |
| ------------- | -------------------------- | ---------------- |
| DB migrations | Manual                     | Auto at startup  |
| Auth          | SKIP_AUTH_VALIDATION=true  | Always validated |
| Redis         | Optional (memory fallback) | Required         |

## Shortcuts

- `/ops-verify` - Full verification
- `/ops-verify quick` - Fast checks
- `/ops-verify ui` - Include Playwright UI testing
