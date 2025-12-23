# Continue Operations Issue

Resume work on an operations issue.

## 1. Load Context

Read in parallel:

- `docs/ops/operations-log.md` - source of truth for status
- `docs/ops/root-cause-patterns.md` - quick sanity checks
- `.ai/ops-*-handoff.md` - find relevant handoff file(s)

## 2. Identify Issue

Input: $ARGUMENTS

**If issue ID provided** (e.g., "OPS-128"):

- Find in ops-log, load handoff if exists

**If no issue ID**:

- Show open issues from ops-log, ask which one

## 3. Show Briefing

```
## Resuming: [OPS-XXX] {title}

**Status**: {from ops-log}
**Priority**: {from ops-log}

### Previous State
{from handoff file - what was done, where it left off}

### Next Steps
{from handoff or infer from status}

### Key Files
{from handoff}
```

## 4. Work Based on Status

**IMPORTANT**: Proceed directly with implementation. Do NOT ask permission to start working unless:

- Missing critical dependencies or configuration
- Requirements are ambiguous and need clarification
- The change has significant risk (data deletion, auth changes, etc.)

**New/Triaging**:

- Run quick sanity checks from root-cause-patterns.md
- Update status to "Investigating"

**Investigating**:

- Continue exploration
- Document findings
- When root cause found, update status

**Fixing**:

- Implement the fix immediately
- When done, prompt for verification (see ops-protocol.md)

**Verifying**:

- Run verification checklist
- When all pass, ready to close

## 5. Pausing Work

When stopping (user says done, or before `/clear`):

1. Update ops-log status if changed
2. Write/update handoff `.ai/ops-{id}-handoff.md`:

```markdown
# [OPS-XXX] {title}

## State

{exactly where things stand - what's working, what's not}

## Done This Session

{what was accomplished}

## Next Steps

1. {specific action}
2. {specific action}

## Key Files

- `path/to/file.ts` - {why it matters}
```

3. If code was written, remind about verification before deploy

That's it. Use `/ops-continue OPS-XXX` to resume.
