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

Infer from context or use argument if provided:

| Type        | When to Use                    | Auto-detect from           |
| ----------- | ------------------------------ | -------------------------- |
| `wip:`      | Work in progress, not complete | Default if unclear         |
| `fix:`      | Issue fully resolved           | Status = Verifying/closing |
| `refactor:` | Code improvement during fix    | Non-functional changes     |
| `test:`     | Adding/updating tests          | Test files modified        |
| `docs:`     | Documentation updates          | .md files only             |

## 5. Stage and Commit

Automatically stage all changes and commit:

1. Run `git add .` to stage all changes
2. Generate commit message:

```
{type}: {brief description} (OPS-XXX)

{optional longer description based on changes}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

3. Run `git commit`

## 6. Push Automatically

Push immediately after commit:

- Run `git push`
- If no upstream, run `git push -u origin {branch}`
- If push fails, report the error

## 7. Update Ops Log

Add entry to the issue's Session Log:

```
- [{timestamp}] Committed and pushed: {hash} - {commit message first line}
```

## 8. Report

```
## Committed and Pushed

**Issue**: [OPS-XXX]
**Commit**: {hash}
**Type**: {wip/fix/refactor/test/docs}
**Files**: {count} files changed
**Branch**: {branch name}

{commit message}
```

## Quick Commit Shortcuts

Support quick patterns:

- `/ops-commit` - Auto-detect type, all changes, current issue
- `/ops-commit wip` - Force WIP commit
- `/ops-commit fix` - Force fix commit
- `/ops-commit OPS-003` - Commit for specific issue

## Important Rules

- Always commit and push automatically - no confirmation needed
- Include issue ID in every commit for traceability
- WIP commits are fine - they can be squashed later
- If on main branch, still push (ops fixes often need to go direct)
- **Verify locally before committing fixes** - If this is a `fix:` commit, ensure the fix was tested locally first. Pushing untested fixes to production wastes deploy cycles (each ~5 min).
