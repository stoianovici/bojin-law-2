# Commit Operations Progress

Commit current work in progress for an operations issue.

**IMPORTANT**: This command enforces the Local Verification Gate for `fix:` and `feat:` commits. See `ops-protocol.md` for details.

## 1. Read Current State

Read in parallel:

- `docs/ops/operations-log.md` - Identify the active issue
- `.claude/commands/ops-protocol.md` - Verification gate protocol

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

| Type        | When to Use                    | Verification Required |
| ----------- | ------------------------------ | --------------------- |
| `wip:`      | Work in progress, not complete | No (but recommended)  |
| `fix:`      | Bug fix complete               | **YES - MANDATORY**   |
| `feat:`     | Feature complete               | **YES - MANDATORY**   |
| `refactor:` | Code improvement               | No (but recommended)  |
| `test:`     | Adding/updating tests          | No                    |
| `docs:`     | Documentation updates          | No                    |

## 5. MANDATORY: Local Verification Gate (For fix:/feat:)

**If commit type is `fix:` or `feat:`, check issue's Local Verification Status.**

**If NOT all verified, show this EXACT prompt:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 LOCAL VERIFICATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're committing a {fix/feat}. This REQUIRES local verification.

Current verification status:
| Step | Status |
|------|--------|
| Prod data test | {✅/⬜/❌} |
| Preflight | {✅/⬜/❌} |
| Docker test | {✅/⬜/❌} |

{If not all ✅}:
⚠️ Verification incomplete. Before committing this {fix/feat}:

Step 1: Test with production data
  $ source .env.prod && pnpm dev
  → Test the specific fix/feature with real data

Step 2: Run preflight checks
  $ pnpm preflight:full
  → Must pass with no errors

Step 3: Test in production Docker
  $ pnpm preview
  → Test the fix/feature in production-identical environment

Have you completed all three steps?
- Yes, all verified ✓ → Proceed with fix:/feat: commit
- Not yet → Complete verification first
- Commit as wip: instead → Downgrade to WIP commit
- Skip verification (NOT RECOMMENDED)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Based on response:**

- **"Yes, all verified"**: Update issue's verification status, proceed with fix:/feat: commit
- **"Not yet"**: Wait for user to complete, then proceed
- **"Commit as wip:"**: Downgrade commit type to `wip:`, proceed
- **"Skip"**: Show strong warning (see below)

**If user skips:**

```
⚠️ STRONG WARNING: Committing fix:/feat: without verification

This is dangerous because:
- The fix/feature is marked as "complete" but untested
- It WILL be deployed with other changes
- If it breaks production, it will be hard to identify

I strongly recommend:
- Commit as `wip:` instead (can upgrade to `fix:` after verification)
- Or complete verification now

Are you ABSOLUTELY sure you want to commit as {fix/feat}? (yes/no)
```

If confirmed, log in issue: `- [{timestamp}] ⚠️ Committed as fix:/feat: WITHOUT verification`

## 6. Stage and Commit

1. Run `git add .` to stage all changes
2. Generate commit message:

```
{type}: {brief description} (OPS-XXX)

{optional longer description based on changes}

Verification: {✅ All passed / ⬜ Pending / ⚠️ Skipped}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

3. Run `git commit`

## 7. Update Issue Verification Status

Update the issue's Local Verification Status:

```markdown
#### Local Verification Status

| Step           | Status     | Date   | Notes   |
| -------------- | ---------- | ------ | ------- |
| Prod data test | {✅/⬜/❌} | {date} | {notes} |
| Preflight      | {✅/⬜/❌} | {date} | {notes} |
| Docker test    | {✅/⬜/❌} | {date} | {notes} |

**Verified**: {Yes/No}
```

## 8. Ask About Push

**DO NOT automatically push.** Ask the user:

```
Commit created: {hash}
Type: {type}
Verification: {✅ All passed / ⬜ Pending / ⚠️ Skipped}

Would you like to push to remote?
- Yes, push now
- No, I'll push later

Note: Pushing does NOT auto-deploy.
After pushing, use `/ops-deploy` when ready to deploy.
```

If user confirms, push.

## 9. Update Ops Log

Add entry to the issue's Session Log:

```
- [{timestamp}] Committed: {hash} - {type}: {message}
  Verification: {✅ All passed / ⬜ Pending / ⚠️ Skipped}
  Pushed: {yes/no}
```

## 10. Report

```
## Committed

**Issue**: [OPS-XXX]
**Commit**: {hash}
**Type**: {type}
**Files**: {count} files changed
**Branch**: {branch name}
**Pushed**: {yes/no}

### Verification Status
| Step | Status |
|------|--------|
| Prod data test | {✅/⬜/❌} |
| Preflight | {✅/⬜/❌} |
| Docker test | {✅/⬜/❌} |
**Verified**: {Yes/No}

{commit message}

### Next Steps
{If verified}:
  Ready for deployment when you choose: `/ops-deploy`

{If not verified}:
  ⚠️ Complete verification before deploying:
  1. $ source .env.prod && pnpm dev (test with prod data)
  2. $ pnpm preflight:full (run checks)
  3. $ pnpm preview (test in Docker)
```

## Quick Commit Shortcuts

- `/ops-commit` - Auto-detect type, current issue
- `/ops-commit wip` - Force WIP commit (no verification required)
- `/ops-commit fix` - Fix commit (verification required)
- `/ops-commit feat` - Feature commit (verification required)
- `/ops-commit OPS-003` - Commit for specific issue

## Important Rules

- **fix: and feat: commits REQUIRE verification** - No exceptions
- **wip: commits don't require verification** - Use for incremental progress
- **DO NOT push automatically** - Always ask user
- **Track verification in commit message** - Makes history clear
- **Update issue verification status** - Keeps tracking accurate
- **If verified locally, it WILL work in production** - This is the guarantee
