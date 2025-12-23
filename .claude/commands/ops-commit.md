# Commit Operations Progress

Commit work for an operations issue.

## Input

$ARGUMENTS options:

- (none) - Auto-detect from context
- `wip` - Work in progress
- `fix` - Bug fix (requires verification)
- `feat` - Feature (requires verification)
- `OPS-XXX` - Specific issue

## 1. Check Status

```bash
git status
git diff --stat
```

## 2. Determine Commit Type

| Type        | When             | Verification |
| ----------- | ---------------- | ------------ |
| `wip:`      | In progress      | No           |
| `fix:`      | Bug fix complete | **Required** |
| `feat:`     | Feature complete | **Required** |
| `refactor:` | Code improvement | No           |
| `docs:`     | Documentation    | No           |

## 3. Verification Gate (fix/feat only)

For `fix:` or `feat:` commits:

```
🔒 Verification required for {fix/feat}:
□ pnpm dev (prod data) - tested
□ pnpm preflight - passed
□ pnpm preview - tested in Docker

All complete?
- Yes → proceed with fix:/feat:
- No → downgrade to wip: commit
```

Cannot commit `fix:` or `feat:` without verification.

## 4. Commit

```bash
git add .
git commit -m "{type}: {description} (OPS-XXX)

🤖 Generated with Claude Code

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## 5. Ask About Push

```
Committed: {hash}

Push to remote?
- Yes
- No (push later)

Note: Push does not deploy. Use /ops-deploy when ready.
```

## 6. Update Issue

Add to issue's Session Log or update status as appropriate.

## Shortcuts

- `/ops-commit` - Auto-detect
- `/ops-commit wip` - WIP (no verification)
- `/ops-commit fix` - Fix (verification required)
- `/ops-commit feat` - Feature (verification required)
