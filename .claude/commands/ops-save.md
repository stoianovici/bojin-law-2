# Save Operations Session

Explicitly save current session state before ending or clearing. Use this before `/clear` or when pausing work.

**IMPORTANT**: This command enforces the Local Verification Gate if code was written. See `ops-protocol.md` for details.

## 1. Read Current State

Read in parallel:

- `docs/ops/operations-log.md` - Find the currently active issue
- `.claude/commands/ops-protocol.md` - Verification gate protocol

## 2. Check for Code Changes

Run `git status` to check if any code was written this session.

**If code changes exist, the Verification Gate is MANDATORY.**

## 3. MANDATORY: Local Verification Gate (If Code Written)

**If `git status` shows modified/untracked code files, show this EXACT prompt:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 LOCAL VERIFICATION GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You wrote code this session. Before saving, verify locally:

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

**Based on response:**

- **"Yes, all verified"**: Update issue's Local Verification Status to all ✅, proceed with save
- **"Not yet"**: Wait for user to complete testing, then proceed with save
- **"Skip"**: Show warning, log skip, then proceed with save

**If user skips:**

```
⚠️ WARNING: Skipping local verification

You are saving without verifying locally. This means:
- The fix/feature MAY break in production when deployed
- Next session should start with verification
- This will be logged in the issue

Proceeding with save...
```

Log in issue: `- [{timestamp}] ⚠️ Session saved WITHOUT local verification`

## 4. Gather Session Summary

Ask the user (or summarize from conversation):

1. **What was accomplished this session?**
2. **What's the current state?**
3. **What are the next steps?**
4. **Any blockers or questions?**

## 5. Update Operations Log

For the active issue:

Update "Last Active" timestamp.

Add Session Log entry:

```
- [{timestamp}] Session {n} ended.
  Accomplished: {summary}
  State: {current state}
  Verification: {✅ All passed / ⚠️ Skipped / ⬜ Pending}
  Next: {next steps}
```

## 6. Update Local Verification Status

Update the issue's Local Verification Status section:

```markdown
#### Local Verification Status

| Step           | Status     | Date           | Notes   |
| -------------- | ---------- | -------------- | ------- |
| Prod data test | {✅/⬜/❌} | {date if done} | {notes} |
| Preflight      | {✅/⬜/❌} | {date if done} | {notes} |
| Docker test    | {✅/⬜/❌} | {date if done} | {notes} |

**Verified**: {Yes/No}
```

## 7. Write Handoff File

Create/update `.ai/ops-{issue-id}-handoff.md`:

```markdown
# Handoff: [OPS-XXX] {title}

**Session**: {n}
**Saved**: {timestamp}
**Status**: {current status}

## Work Completed This Session

{detailed summary of what was done}

## Current State

{exactly where things stand}

- What's working
- What's not working
- What was tried

## Local Verification Status

| Step           | Status     | Notes   |
| -------------- | ---------- | ------- |
| Prod data test | {✅/⬜/❌} | {notes} |
| Preflight      | {✅/⬜/❌} | {notes} |
| Docker test    | {✅/⬜/❌} | {notes} |

**Verified**: {Yes/No}

{If not verified}: ⚠️ NEXT SESSION MUST START WITH VERIFICATION

## Investigation Findings

{any discoveries, hypotheses tested, etc.}

## Blockers/Questions

{anything blocking progress}

## Next Steps

1. {specific action 1}
2. {specific action 2}
3. {etc.}

## Key Files

{files that are relevant, with brief notes}

- `path/to/file.ts` - {what's relevant about it}

## Commands/Context to Remember

{any useful commands, error messages, etc.}
```

## 8. Check for Uncommitted Changes

**DO NOT automatically commit or push.** Just inform the user:

1. **Run `git status`** to check for changes

2. **If there are changes**, inform the user:

   ```
   You have uncommitted changes. When ready:
   - `/ops-commit` - to commit changes
   - `/ops-deploy` - to deploy to production (after verification)
   ```

3. **Record status** in handoff file under "Commands/Context to Remember"

## 9. Confirm Save

```
## Session Saved

**Issue**: [OPS-XXX] {title}
**Status**: {status}
**Handoff**: .ai/ops-{issue-id}-handoff.md

### Local Verification
| Step | Status |
|------|--------|
| Prod data test | {✅/⬜/❌} |
| Preflight | {✅/⬜/❌} |
| Docker test | {✅/⬜/❌} |
**Verified**: {Yes/No}

### Git Status
**Uncommitted changes**: {yes/no}
**Pushed**: {yes/no/n/a}

To resume: `/ops-continue OPS-XXX`

{If not verified}:
⚠️ IMPORTANT: Next session must complete local verification before proceeding.

Safe to `/clear` now - context is preserved.
```

## Important Rules

- **ALWAYS show Verification Gate if code was written** - No exceptions
- Always be thorough in handoff notes - you're writing for a future version of yourself with no memory
- Include specific file paths and line numbers where relevant
- Include exact error messages if debugging
- Next steps should be actionable and specific
- **Track verification status** - This determines if work is ready for deployment
- **DO NOT automatically commit or push** - Let the user decide when to commit/deploy
