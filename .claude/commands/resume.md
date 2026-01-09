# /resume - Continue from Checkpoint

**Purpose**: Load checkpoint context and continue work seamlessly.
**Mode**: Context loading + autonomous continuation
**Input**: `.claude/work/checkpoints/[name].md`

## Invocation

```
/resume [name]
```

If no name provided, list available checkpoints for user to choose.

---

## Execution Steps

### 1. Load Checkpoint

```
Read: .claude/work/checkpoints/[name].md
```

If checkpoint not found:

- List available checkpoints in `.claude/work/checkpoints/`
- Ask user which one to resume

### 2. Load Related Context

From the checkpoint, identify and load:

- Any referenced task docs (`.claude/work/tasks/*.md`)
- Key files mentioned in the Files table (read those that are critical for context)

**Parallel reads** - load checkpoint + related docs simultaneously when possible.

### 3. Acknowledge Context

Provide a brief status update:

```markdown
## Resuming: [Checkpoint Name]

**Goal**: [From checkpoint]

**Where we left off**: [Current state summary]

**Decisions in effect**:

- [Key decision 1]
- [Key decision 2]

**First action**: [From checkpoint's "First action"]

Ready to continue. [Ask clarifying question if needed, or state what you're about to do]
```

### 4. Continue Work

Execute the "First action" from the checkpoint, unless user redirects.

---

## Listing Checkpoints

When invoked without a name, or when the specified checkpoint isn't found:

```markdown
## Available Checkpoints

| Name             | Created    | Goal                      |
| ---------------- | ---------- | ------------------------- |
| workflow-upgrade | 2026-01-09 | Redesign Claude workflows |
| email-threading  | 2026-01-08 | Add email thread view     |

Which checkpoint would you like to resume?
```

---

## Rules

- LOAD context before acknowledging (don't ask user to explain)
- SUMMARIZE state concisely - user already knows the context
- CONTINUE naturally - don't make user re-explain
- If checkpoint is stale or situation changed, ASK before proceeding

## Stale Checkpoint Detection

A checkpoint may be stale if:

- Files mentioned have been modified since checkpoint creation
- Related task docs have been updated
- Significant time has passed

If detected, note:

```
Note: [file] has been modified since this checkpoint.
Should I review the changes before continuing?
```

---

## Integration with Task Workflow

Resume works with both:

1. **Standalone checkpoints** - mid-conversation pauses
2. **Task-based work** - can resume mid-phase (mid-research, mid-implementation)

For task-based work, the checkpoint should reference the task doc, and /resume will load both.
