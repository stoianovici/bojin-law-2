# Continue Operations Issue

You are resuming work on an operations issue. This is a cross-session workflow - restore context and continue methodically.

## 1. Restore Context

Read these files in parallel:

- `docs/ops/operations-log.md` - Source of truth for all issues
- `docs/ops/root-cause-patterns.md` - Common root causes and quick checks
- `docs/project-conventions.md` - Code patterns and implementation standards
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

### Previous Session Summary
{last entry from Session Log}

### Last Known State
{from handoff file if exists}

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

**Important**: Before writing any code, review `docs/project-conventions.md` to ensure your implementation follows established patterns (component structure, hook patterns, service patterns, Romanian UI text, etc.).

Based on current status, proceed with appropriate workflow:

**If Status = New or Triaging**:

- Run **Quick Sanity Checks** from `root-cause-patterns.md`:
  1. Does the data exist in DB?
  2. Does GraphQL return it?
  3. Does the frontend fetch it?
  4. Does the component render it (not hardcoded)?
- Check if symptom matches known patterns in the pattern library
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
- **Check for local dev environment** in the issue's "Local Dev Environment" section
- **ALWAYS test fixes locally first** before deploying:
  1. For quick iteration: `pnpm dev` (hot reload, development mode)
  2. For production-like testing: `pnpm preview` (builds and runs production Docker)
  3. Test the fix with curl, browser, or logs
  4. Iterate quickly on fixes (seconds) instead of waiting for deploys (minutes)
- Only deploy after local verification passes
- Continue implementation
- Run tests
- Ask: "Ready to verify the fix?"

**If Status = Verifying**:

- Run verification steps
- Check for regressions
- Ask: "Ready to close this issue?"

## 6. During Work

As you work:

1. **Log everything** - Add entries to Session Log with timestamps
2. **Track files** - Update "Files Involved" as you touch new files
3. **Use TodoWrite** - Track current session tasks
4. **Update status** - Change status as you progress through stages

## 7. Session End Protocol

When user says they're done, or before any `/clear`:

1. Update Session Log with summary of work done
2. Write handoff file `.ai/ops-{issue-id}-handoff.md`:

   ```markdown
   # Handoff: [OPS-XXX] {title}

   **Session**: {n}
   **Date**: {timestamp}
   **Status**: {current}

   ## Work Completed This Session

   {summary}

   ## Current State

   {where things stand}

   ## Blockers/Questions

   {any blockers}

   ## Next Steps

   {specific actions for next session}

   ## Key Files

   {files that need attention}
   ```

3. Update ops log with session summary
4. Remind user: "Context saved. Use `/ops-continue OPS-XXX` to resume."

## Important Rules

- **Always restore context first** - Read ops log and handoff before doing anything
- **Always save context at end** - Never let work be lost
- **Be methodical** - Follow the investigation stages, don't jump ahead
- **Document everything** - Future sessions depend on good notes
- **Use parallel tools** - Load multiple files simultaneously
- **Test locally before deploying** - Use `pnpm dev` for quick iteration, `pnpm preview` for production-like testing
- **Pushing does NOT deploy** - Use `pnpm deploy:production` to deploy after testing locally
