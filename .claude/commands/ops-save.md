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

## 5. Confirm Save

```
## Session Saved

**Issue**: [OPS-XXX] {title}
**Status**: {status}
**Handoff**: .ai/ops-{issue-id}-handoff.md

To resume: `/ops-continue OPS-XXX`

Safe to `/clear` now - context is preserved.
```

## Important Rules

- Always be thorough in handoff notes - you're writing for a future version of yourself with no memory
- Include specific file paths and line numbers where relevant
- Include exact error messages if debugging
- Next steps should be actionable and specific
