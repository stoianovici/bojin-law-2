# Save Operations Session

Explicitly save current state before `/clear` or when pausing work.

## What This Does

1. Find the active issue from `docs/ops/operations-log.md`
2. Run `git status` to check for uncommitted changes
3. Execute the pause workflow from `/ops-continue` (Section 5)

## Quick Reference

The pause workflow:

1. Update ops-log status if changed
2. Write handoff to `.claude/ops/ops-{id}-handoff.md`
3. If code written, remind about verification

## Handoff Format

```markdown
# [OPS-XXX] {title}

## State

{where things stand}

## Done This Session

{what was accomplished}

## Next Steps

1. {action}
2. {action}

## Key Files

- `path/to/file.ts` - {why}
```

## After Save

```
Session saved for [OPS-XXX] {title}
Handoff: .claude/ops/ops-{id}-handoff.md
Uncommitted changes: {yes/no}

Resume with: /ops-continue OPS-XXX
```

Safe to `/clear`.
