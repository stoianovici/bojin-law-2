# /checkpoint - Session Handoff

**Purpose**: Save conversation state for seamless continuation in a new session.
**Mode**: Autonomous (Claude generates checkpoint)
**Output**: `.claude/work/checkpoints/[name].md`

## Invocation

```
/checkpoint [name]
```

If no name provided, use timestamp: `checkpoint-YYYYMMDD-HHMM`

---

## What Makes a Good Checkpoint

A checkpoint should let a fresh Claude session continue as if no break occurred. Include:

1. **What we're doing** - goal, not just topic
2. **Decisions made** - the contract we're working from
3. **Current state** - what's done, what's in progress
4. **Files involved** - with line references where relevant
5. **Next action** - exactly what to do first

---

## Execution Steps

### 1. Analyze Conversation

Extract from the current session:

- Main goal/objective
- Key decisions (explicit and implicit)
- Files read, created, or modified
- Current progress (what's done, what's pending)
- Any blockers or open questions

### 2. Check for Related Task Docs

Look in `.claude/work/tasks/` for any related docs. If found, reference them.

### 3. Generate Checkpoint

**Write to**: `.claude/work/checkpoints/[name].md`

```markdown
# Checkpoint: [Name]

**Created**: [YYYY-MM-DD HH:MM]
**Goal**: [One-line description of what we're trying to accomplish]

---

## Context

[2-3 sentences describing the situation. What prompted this work? What's the background?]

## Decisions

| Decision          | Details     | Rationale |
| ----------------- | ----------- | --------- |
| [What we decided] | [Specifics] | [Why]     |

> If no explicit decisions yet, note "Decisions pending - still in exploration phase"

## Progress

### Completed

- [x] [Item with outcome]
- [x] [Item with outcome]

### In Progress

- [ ] [Current item] - at [specific point]

### Pending

- [ ] [Future item]
- [ ] [Future item]

## Files

| File              | Status   | Notes              |
| ----------------- | -------- | ------------------ |
| path/to/file.ts   | Read     | [relevant finding] |
| path/to/other.tsx | Modified | [what changed]     |
| path/to/new.ts    | Created  | [purpose]          |

## Key Context

[Anything critical that isn't captured above - gotchas, constraints, user preferences discovered during conversation]

## Related Docs

- `.claude/work/tasks/[relevant-doc].md` (if any)

---

## Resume

To continue this work:
```

/resume [name]

```

**First action**: [Exactly what to do when resuming - be specific]

**Open questions**: [Any unresolved questions, or "None"]
```

### 4. Confirm to User

```
Checkpoint saved: .claude/work/checkpoints/[name].md

To resume later:
/resume [name]
```

---

## Rules

- EXTRACT from conversation, don't ask user to summarize
- BE SPECIFIC in "First action" - not "continue work" but "implement the X function in Y file"
- INCLUDE file:line references where relevant
- CAPTURE implicit decisions (things we agreed without formal "Decision:" labels)
- KEEP it scannable - tables and bullets, not paragraphs

## Directory Structure

```
.claude/work/
├── checkpoints/          # Checkpoint files
│   ├── workflow-upgrade.md
│   └── checkpoint-20260109-1430.md
├── tasks/                # Task docs (existing)
└── current.md            # Active work log
```
