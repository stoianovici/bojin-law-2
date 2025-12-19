# Ops Protocol: Local Verification Gate

**This protocol is MANDATORY for all /ops commands. No exceptions.**

## Core Principle

> Work is NOT complete until verified locally in a production-identical environment.
> If it works locally with production data + production Docker, it WILL work in production.

## Browser Automation Capability

The Playwright MCP is available for automated browser testing and verification.

**Use Playwright MCP when you need to:**

- Visually verify UI changes in the browser
- Take screenshots for documentation or debugging
- Interact with the application (click, type, navigate)
- Inspect network requests, console logs, or DOM state
- Debug UI issues that require seeing what the user sees

**How to invoke:**

- Say "use playwright mcp to..." to ensure the MCP tools are used
- Example: "Use playwright mcp to open http://localhost:3000 and take a screenshot"
- Example: "Use playwright mcp to navigate to /cases and verify the table loads"

**Available Playwright MCP tools:**

- `browser_navigate` - Navigate to a URL
- `browser_screenshot` - Take a screenshot (you can view it)
- `browser_click` - Click elements
- `browser_type` - Type text into inputs
- `browser_snapshot` - Get accessibility tree/DOM snapshot
- `browser_console_messages` - View console output
- `browser_network_requests` - Inspect network activity

**When to use Playwright vs manual verification:**
| Scenario | Use Playwright | Ask User |
|----------|----------------|----------|
| Check if page loads without errors | ✓ | |
| Verify specific UI element appears | ✓ | |
| Test requires login with real credentials | | ✓ |
| Complex multi-step user flow | ✓ then verify | |
| Visual design review needed | ✓ screenshot | ✓ review |

## The Verification Gate

Before ANY of these actions, the Verification Gate MUST pass:

- Marking work as "done" or "complete"
- Committing with `fix:` or `feat:` prefix
- Suggesting deployment
- Closing an issue
- Saving a session where work was completed

## Verification Gate Checklist

```
## Local Verification Gate (MANDATORY)

□ Step 1: Production Data Test
  Command: source .env.prod && pnpm dev
  Test: Manually verify the fix/feature works with real production data

□ Step 2: Preflight Check
  Command: pnpm preflight:full
  Validates: TypeScript, tests, Docker build, parity

□ Step 3: Production Docker Test
  Command: pnpm preview
  Test: Manually verify the fix/feature works in production Docker
  URL: http://localhost:3000

All three steps MUST pass before work is considered "verified".
```

## Verification Prompt (Use This Exact Text)

When prompting the user, use this exact message:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 LOCAL VERIFICATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before proceeding, you must verify locally:

Step 1: Test with production data
  $ source .env.prod && pnpm dev
  → Open http://localhost:3000
  → Test the specific fix/feature
  → Confirm it works with real data

Step 2: Run preflight checks
  $ pnpm preflight:full
  → Must pass with no errors

Step 3: Test in production Docker
  $ pnpm preview
  → Open http://localhost:3000
  → Test the specific fix/feature again
  → This is identical to production

Have you completed all three steps?
- Yes, all verified ✓
- Not yet, I need to run the tests
- Skip (NOT RECOMMENDED - may break production)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## When to Show the Verification Prompt

| Command         | Trigger                                                              |
| --------------- | -------------------------------------------------------------------- |
| `/ops-continue` | When status changes to "Verifying" OR when suggesting deployment     |
| `/ops-save`     | ALWAYS before saving if any code was written                         |
| `/ops-commit`   | ALWAYS before committing (block `fix:`/`feat:` without verification) |
| `/ops-close`    | ALWAYS before closing (cannot close unverified)                      |
| `/ops-deploy`   | ALWAYS before deploying (already enforced)                           |

## Tracking Verification in Issues

Every issue MUST have this section:

```markdown
#### Local Verification Status

| Step           | Status                             | Date | Notes |
| -------------- | ---------------------------------- | ---- | ----- |
| Prod data test | ⬜ Pending / ✅ Passed / ❌ Failed |      |       |
| Preflight      | ⬜ Pending / ✅ Passed / ❌ Failed |      |       |
| Docker test    | ⬜ Pending / ✅ Passed / ❌ Failed |      |       |

**Verified**: No / Yes (all three ✅)
```

## Why This Works

| Local Test        | What It Catches                                      |
| ----------------- | ---------------------------------------------------- |
| Production data   | Data-specific bugs, edge cases, real-world scenarios |
| Preflight         | TypeScript errors, test failures, build issues       |
| Production Docker | Runtime differences, missing deps, env var issues    |

If all three pass, the code is **production-ready** because:

- Same data as production
- Same build process as production
- Same runtime as production
- Same Node version as production
- Same dependencies as production

## User Can Skip (But Is Warned)

If user chooses "Skip":

```
⚠️ WARNING: Skipping local verification

You are proceeding without verifying locally. This means:
- The fix/feature MAY break in production
- You'll need to debug in production (slow, risky)
- Other accumulated changes may also be affected

Are you absolutely sure? (yes/no)
```

If they confirm skip, log it in the issue:

```
- [{timestamp}] ⚠️ LOCAL VERIFICATION SKIPPED by user request
```

## Batched Deployments

Since deployments are infrequent and changes pile up:

1. Each fix/feature MUST be verified locally when completed
2. Before batch deployment, run full verification again
3. The `/ops-deploy` command will run smoke tests after deploy

This ensures every change is verified at creation time AND again at deploy time.
