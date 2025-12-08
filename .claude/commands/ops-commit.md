# Commit Operations Progress

Commit current work in progress for an operations issue. Use this to checkpoint your work without ending the session.

## 1. Read Current State

Read `docs/ops/operations-log.md` to identify the active issue.

## 2. Check Git Status

Run `git status` and `git diff --stat` to show:

- Modified files
- Untracked files
- Staged changes

## 3. Identify Issue Context

The user's input is: $ARGUMENTS

**If issue ID provided** (e.g., "OPS-003"):

- Use that issue ID in commit message

**If no issue ID**:

- Use the most recently active issue from ops log

## 4. Determine Commit Type

Ask user or infer from context:

| Type        | When to Use                    | Prefix                     |
| ----------- | ------------------------------ | -------------------------- |
| `wip:`      | Work in progress, not complete | Partial fix, investigation |
| `fix:`      | Issue fully resolved           | Ready to close             |
| `refactor:` | Code improvement during fix    | Cleanup, optimization      |
| `test:`     | Adding/updating tests          | Test coverage              |
| `docs:`     | Documentation updates          | Comments, README           |

## 5. Stage Files

Show files and ask which to include:

- "Stage all changes? (y/n)"
- Or: "Select files to stage (comma-separated numbers)"

Stage selected files with `git add`.

## 6. Create Commit

Generate commit message based on type and context:

```
{type}: {brief description} (OPS-XXX)

{optional longer description}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Show the commit message and ask for confirmation before committing.

## 7. Push (Optional)

Ask: "Push to remote? (y/n)"

If yes:

- Check current branch
- If on main/master, warn: "You're on {branch}. Push directly? (y/n)"
- Run `git push`

## 8. Update Ops Log

Add entry to the issue's Session Log:

```
- [{timestamp}] Committed: {hash} - {commit message first line}
```

## 9. Report

```
## Committed

**Issue**: [OPS-XXX]
**Commit**: {hash}
**Type**: {wip/fix/refactor/test/docs}
**Files**: {count} files changed
**Pushed**: {yes/no}

{commit message}
```

## Quick Commit Shortcuts

Support quick patterns:

- `/ops-commit wip` - Quick WIP commit, all changes, current issue
- `/ops-commit fix` - Fix commit, all changes, current issue
- `/ops-commit OPS-003 wip` - WIP for specific issue

## Important Rules

- Always show what will be committed before committing
- Never auto-push to main/master without explicit confirmation
- Include issue ID in every commit for traceability
- WIP commits are fine - they can be squashed later
