# /checkpoint - Session Handoff

**Purpose**: Save state for next session when context is running low or work pauses mid-task.
**Mode**: Autonomous (Claude prepares handoff)
**Output**: Updates task doc in `.claude/work/tasks/` with checkpoint section

## When to Trigger

- Context is getting long (many messages)
- Mid-task pause needed
- Unexpected complexity found
- User requests pause

**Note**: For normal workflow, you don't need `/checkpoint`. Each step (brainstorm → research → plan → implement) produces a task doc that the next session picks up. Use `/checkpoint` only when stopping mid-step.

---

## Execution Steps

### 1. Identify Active Task Doc

Find the current task doc in `.claude/work/tasks/`:

- If mid-research: `research-{slug}.md`
- If mid-planning: `plan-{slug}.md`
- If mid-implementation: `implement-{slug}.md`

### 2. Add Checkpoint Section

Append to the active task doc:

```markdown
---

## CHECKPOINT - [YYYY-MM-DD HH:MM]

### Session Summary

[2-3 sentences on what happened]

### Progress

- [x] Completed item 1
- [x] Completed item 2
- [ ] In progress: [item] - stopped at [specific point]
- [ ] Pending: [items]

### Files Modified (if any)

| File    | Status   | Notes   |
| ------- | -------- | ------- |
| src/... | Complete | ...     |
| src/... | Partial  | Needs X |

### Resume Instructions

1. Run: `/[command] {slug}` (same command, same slug)
2. Continue from: [specific point]
3. Next action: [exactly what to do]

### Critical Context

[Anything the next session MUST know that isn't in the doc above]

### Blockers

- [Any blockers, or "None"]
```

### 3. Report to User

```markdown
## Checkpoint Added

Task doc updated: `{task-doc-name}.md`

### To Resume

Start new session and run:
`/[command] {slug}`

The task doc contains all context + checkpoint notes.
```

## Rules

- APPEND checkpoint to existing task doc (don't create separate file)
- SPECIFIC resume instructions
- CAPTURE critical context that's not already in the doc
- Task docs should remain self-contained after checkpoint
