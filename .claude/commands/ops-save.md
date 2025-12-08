# Save Operations Session

Explicitly save current session state before ending or clearing. Use this before `/clear` or when pausing work.

## 1. Read Current State

Read `docs/ops/operations-log.md` to find the currently active issue (most recent "Last Active").

## 2. Gather Session Summary

Ask the user (or summarize from conversation):

1. **What was accomplished this session?**
2. **What's the current state?**
3. **What are the next steps?**
4. **Any blockers or questions?**

## 3. Update Operations Log

For the active issue:

Update "Last Active" timestamp.

Add Session Log entry:

```
- [{timestamp}] Session {n} ended. Accomplished: {summary}. State: {current state}. Next: {next steps}
```

## 4. Write Handoff File

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

## 5. Git Commit (Optional)

Check for uncommitted work:

1. **Run `git status`** to check for changes

2. **If there are changes**, ask user:
   - "You have uncommitted changes. Commit before saving session? (y/n)"
   - If yes, create a WIP commit:

     ```
     wip: {brief description} (OPS-XXX)

     Work in progress for issue OPS-XXX.
     Status: {current status}
     Next steps: {brief next steps}

     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
     ```

3. **Ask about pushing**:
   - "Push WIP commit to remote? (y/n)"
   - This ensures code is backed up even if local machine has issues

4. **Record commit info** in handoff file under "Commands/Context to Remember"

## 6. Confirm Save

```
## Session Saved

**Issue**: [OPS-XXX] {title}
**Status**: {status}
**Handoff**: .ai/ops-{issue-id}-handoff.md
**Commit**: {hash or "no changes"}
**Pushed**: {yes/no/n/a}

To resume: `/ops-continue OPS-XXX`

Safe to `/clear` now - context is preserved.
```

## Important Rules

- Always be thorough in handoff notes - you're writing for a future version of yourself with no memory
- Include specific file paths and line numbers where relevant
- Include exact error messages if debugging
- Next steps should be actionable and specific
- Committing WIP ensures code isn't lost between sessions
