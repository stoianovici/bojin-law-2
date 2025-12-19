# Continue Operations Issue

You are resuming work on an operations issue. This is a cross-session workflow - restore context and continue methodically.

**IMPORTANT**: This command enforces the Local Verification Gate. See `ops-protocol.md` for details.

## 1. Restore Context

Read these files in parallel:

- `docs/ops/operations-log.md` - Source of truth for all issues
- `docs/ops/root-cause-patterns.md` - Common root causes and quick checks
- `docs/project-conventions.md` - Code patterns and implementation standards
- `.claude/commands/ops-protocol.md` - Verification gate protocol
- `.ai/ops-*-handoff.md` - Find the most recent handoff file(s)

## 2. Identify Target Issue

The user's input is: $ARGUMENTS

**If issue ID provided** (e.g., "OPS-003"):

- Find that specific issue in the ops log
- Load its handoff file if exists: `.ai/ops-{issue-id}-handoff.md`

**If no issue ID provided**:

- Find the most recently active issue (by "Last Active" field)
- Or show active issues and ask user to select

## 3. Display Session Briefing

Show the user:

```
## Resuming: [OPS-XXX] {title}

**Status**: {current status}
**Priority**: {priority}
**Sessions**: {count} (this is session {count + 1})
**Last Active**: {date}

### Local Verification Status
{from issue - show current verification state}

### Previous Session Summary
{last entry from Session Log}

### Last Known State
{from handoff file if exists}

### Environment Strategy
{from issue's Environment Strategy section, or determine based on type}

### Suggested Next Steps
{from handoff file or infer from status}

### Files Previously Involved
{list from issue}
```

## 4. Update Issue Tracking

Update the ops log:

- Increment session count
- Update "Last Active" to now
- Add session start entry to Session Log:
  ```
  - [{timestamp}] Session {n} started. Continuing from: {status}
  ```

## 5. Begin Investigation/Work

**Important**: Before writing any code, review `docs/project-conventions.md` to ensure your implementation follows established patterns.

Based on current status, proceed with appropriate workflow:

**If Status = New or Triaging**:

- Run **Quick Sanity Checks** from `root-cause-patterns.md`
- Check if symptom matches known patterns
- If multiple hypotheses, suggest running `/ops-investigate`
- Update status to "Investigating"

**If Status = Investigating**:

- Review previous findings in Session Log
- Continue exploration with Grep/Glob/Explore
- Document new findings
- Ask: "Ready to form a hypothesis about root cause?"

**If Status = Root Cause Found**:

- Review the documented root cause
- Plan the fix approach
- Ask: "Ready to implement the fix?"

**If Status = Fixing**:

- Review what's been done
- Continue implementation
- Run tests
- **When implementation is complete, IMMEDIATELY show the Verification Gate prompt** (see Section 6)

**If Status = Verifying**:

- Check Local Verification Status in issue
- If not all verified, show Verification Gate prompt
- If all verified, ask: "Ready to close this issue?"

## 6. MANDATORY: Local Verification Gate

**Trigger this prompt when ANY of these occur:**

- User says "done", "finished", "complete", "ready to deploy"
- You've finished implementing a fix or feature
- Status is about to change to "Verifying"
- User asks about deployment

**Playwright MCP Assisted Verification:**

You can use Playwright MCP to perform automated UI verification for Steps 1 and 3:

```
Use playwright mcp to:
1. Navigate to http://localhost:3000
2. Take a screenshot
3. Test the specific fix/feature (click, navigate, verify elements)
4. Check console for errors
5. Report what you see
```

This allows you to visually verify without requiring the user to manually check every time.

**Show this EXACT prompt:**

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
  💡 I can use Playwright MCP to test this automatically

Step 2: Run preflight checks
  $ pnpm preflight:full
  → Must pass with no errors

Step 3: Test in production Docker
  $ pnpm preview
  → Open http://localhost:3000
  → Test the specific fix/feature again
  → This is identical to production
  💡 I can use Playwright MCP to test this automatically

Have you completed all three steps?
- Yes, all verified ✓
- Not yet, I need to run the tests
- Use Playwright to verify (I'll test with browser automation)
- Skip (NOT RECOMMENDED - may break production)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If user selects "Use Playwright to verify":**

1. Ensure dev server or preview is running
2. Use Playwright MCP to navigate to the app
3. Take screenshots and verify the fix/feature works
4. Check for console errors
5. Report findings with screenshots
6. Ask user to confirm the verification is acceptable

**Based on response:**

- **"Yes, all verified"**: Update issue's Local Verification Status to all ✅, proceed
- **"Not yet"**: Wait for user to complete testing, ask for results
- **"Skip"**: Show warning (see below), log skip in issue

**If user skips:**

```
⚠️ WARNING: Skipping local verification

You are proceeding without verifying locally. This means:
- The fix/feature MAY break in production
- You'll need to debug in production (slow, risky)
- Other accumulated changes may also be affected

Are you absolutely sure? (yes/no)
```

Log in issue: `- [{timestamp}] ⚠️ LOCAL VERIFICATION SKIPPED by user request`

## 7. During Work

As you work:

1. **Log everything** - Add entries to Session Log with timestamps
2. **Track files** - Update "Files Involved" as you touch new files
3. **Use TodoWrite** - Track current session tasks
4. **Update status** - Change status as you progress
5. **ALWAYS prompt for verification** - When work is complete

## 8. Session End Protocol

When user says they're done, or before any `/clear`:

**FIRST: Show Local Verification Gate if any code was written this session**

Then:

1. Update Session Log with summary of work done
2. Update Local Verification Status in issue
3. Write handoff file `.ai/ops-{issue-id}-handoff.md`:

   ```markdown
   # Handoff: [OPS-XXX] {title}

   **Session**: {n}
   **Date**: {timestamp}
   **Status**: {current}

   ## Work Completed This Session

   {summary}

   ## Current State

   {where things stand}

   ## Local Verification Status

   | Step           | Status   | Notes   |
   | -------------- | -------- | ------- |
   | Prod data test | ✅/⬜/❌ | {notes} |
   | Preflight      | ✅/⬜/❌ | {notes} |
   | Docker test    | ✅/⬜/❌ | {notes} |

   **Verified**: {Yes/No}

   ## Blockers/Questions

   {any blockers}

   ## Next Steps

   {specific actions for next session}

   ## Key Files

   {files that need attention}
   ```

4. Update ops log with session summary
5. Remind user: "Context saved. Use `/ops-continue OPS-XXX` to resume."

## Important Rules

- **ALWAYS show Verification Gate when work is complete** - No exceptions
- **ALWAYS restore context first** - Read ops log and handoff before doing anything
- **ALWAYS save context at end** - Never let work be lost
- **Track verification status** - Update issue with verification results
- **If it passes local verification, it WILL work in production** - This is the guarantee
