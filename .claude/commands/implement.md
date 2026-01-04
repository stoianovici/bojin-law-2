# /implement - Parallel Execution

**Purpose**: Execute approved plan, parallelizing where possible.
**Mode**: Autonomous with progress updates
**Input**: `.claude/work/tasks/plan-{slug}.md`
**Output**: `.claude/work/tasks/implement-{slug}.md`

## Invocation

```
/implement plan-{slug}
```

## Auto-load Context (first step)

```
Read: .claude/work/tasks/plan-{slug}.md → Decisions + tasks
```

---

## Execution Strategy

### Before Starting

Review the Decisions section. These are the requirements. Do not deviate.

### Parallel Groups → Sub-agents (up to 5)

For each parallel group, spawn sub-agents.

**CRITICAL**: Each agent receives the Decisions as context:

```
## Your Task
[Task description from plan]

## File
[Exclusive file ownership]

## Decisions You Must Follow
[Copy the entire Decisions section from plan]

## Constraints
- Only modify your assigned file
- Follow existing code patterns
- Implement exactly what Decisions specify - no more, no less
```

### Sequential Tasks → Direct execution

For dependent tasks, Claude executes directly with full visibility.

### After Each Group

1. Verify all agents completed
2. Run type-check/lint on changed files
3. Fix any issues before next group
4. Check: Does output match Decisions?

---

## Progress Tracking

Use TodoWrite throughout:

```
[x] Task 1.1: [Title] - implements [Decision X]
[x] Task 1.2: [Title] - implements [Decision Y]
[ ] Task 2: [Title] - in progress
[ ] Task 3.1: [Title] - pending
```

## Output During Implementation

After each parallel group:

```markdown
## Group 1 Complete

### Results

- [x] Task 1.1: Created src/components/X.tsx (implements Decision: ...)
- [x] Task 1.2: Created src/hooks/Y.ts (implements Decision: ...)

### Verification

- Type-check: ✓
- Lint: ✓
- Matches Decisions: ✓

### Next

Starting Task 2...
```

---

## Error Handling

If a sub-agent fails:

1. Report which task failed and why
2. Attempt fix directly
3. If blocked, pause and ask user

If verification fails:

1. Fix issues before proceeding
2. Re-run verification
3. Only continue when clean

If implementation conflicts with Decisions:

1. STOP
2. Report the conflict
3. Ask user how to proceed

---

## Completion: Task Document

**Write to**: `.claude/work/tasks/implement-{slug}.md`

```markdown
# Implementation: [Feature Name]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Input**: `plan-{slug}.md`
**Next step**: `/commit` or `/iterate`

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint passing
- [x] All Decisions implemented

## Decisions - Implementation Status

| Decision    | Status | Implemented In    |
| ----------- | ------ | ----------------- |
| [From plan] | ✓ Done | src/path/file.tsx |
| [From plan] | ✓ Done | src/path/other.ts |

## Files Changed

| File    | Action   | Implements    |
| ------- | -------- | ------------- |
| src/... | Created  | Decision X    |
| src/... | Modified | Decision Y, Z |

## Task Log

- [x] Task 1.1: [Title] - [outcome]
- [x] Task 1.2: [Title] - [outcome]
- [x] Task 2: [Title] - [outcome]

## Issues Encountered

[Any problems and how resolved, or "None"]

---

## Next Step

Run `/iterate` to visually verify, or `/commit` to commit.
```

---

## Checkpoint Triggers

Run /checkpoint if:

- Context getting long
- Major milestone complete
- Unexpected complexity
- Before starting new parallel group

---

## Rules

- EVERY sub-agent gets the Decisions section
- NO implementing things not in Decisions
- NO skipping things in Decisions
- VERIFY after each group
- STOP if Decisions conflict with reality - ask user

## Archive After Success

```bash
mkdir -p .claude/work/tasks/done
mv .claude/work/tasks/implement-{slug}.md .claude/work/tasks/done/
```

## Transition

When complete:

1. Write the implementation doc
2. Archive to `done/`
3. Tell user: "Implementation complete. Run `/iterate` to verify visually, or `/commit` to commit."
