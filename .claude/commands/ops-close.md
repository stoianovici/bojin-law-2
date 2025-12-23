# Close Operations Issue

Close a resolved issue with documentation.

## Input

$ARGUMENTS - Issue ID (e.g., "OPS-128"). If omitted, shows issues in Verifying status.

## 1. Verify Before Closing

**Closing requires completed verification.** Check with user:

```
🔒 Verification check for [OPS-XXX]:
□ pnpm dev (prod data) - tested fix works
□ pnpm preflight - all checks pass
□ pnpm preview - tested in Docker

All complete?
```

If not complete, user must finish verification first.

## 2. Document Resolution

Ensure issue has:

- Root cause (for bugs)
- Fix description
- Files involved

Ask if missing: "What was the root cause and fix?"

## 3. Check Pattern Library

```
Root cause was: {root cause}
Add to docs/ops/root-cause-patterns.md? (y/n)
```

If yes, add the pattern.

## 4. Update ops-log

1. Change status to "Closed" in Quick Reference table
2. Move issue file from `issues/` to `archive/`

## 5. Clean Up

Delete handoff file: `.ai/ops-{id}-handoff.md`

## 6. Report

```
Closed: [OPS-XXX] {title}

Resolution: {summary}
Verified: ✓ prod data, preflight, Docker

Ready for deployment with /ops-deploy
```
