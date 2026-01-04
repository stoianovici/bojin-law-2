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
Read: .claude/work/tasks/plan-{slug}.md → Full context and task breakdown
```

The plan doc contains project context, approach, and all tasks with file assignments. No other context loading needed.

---

## Prerequisites (from plan doc)

- Context summary with tech stack and patterns
- Task breakdown with parallel groups
- File ownership assignments

## Execution Strategy

### Parallel Groups → Sub-agents (up to 5)

For each parallel group, spawn sub-agents:

```
Task 1.1 → Agent A (exclusive: src/components/X.tsx)
Task 1.2 → Agent B (exclusive: src/hooks/Y.ts)
Task 1.3 → Agent C (exclusive: src/lib/Z.ts)
```

Each agent receives:

```
Task: [Task description from plan]
File: [Exclusive file ownership]
Context: [Architecture patterns + relevant existing code]
Output: [What to create/modify]
Constraints: [Style guide, patterns, don't touch other files]
```

### Sequential Tasks → Direct execution

For dependent tasks, Claude executes directly:

- User has full visibility
- Can intervene if needed

### After Each Group

1. Verify all agents completed
2. Run type-check/lint on changed files
3. Fix any issues before next group
4. Update TodoWrite status

## Progress Tracking

Use TodoWrite throughout:

```
[x] Task 1.1: Created Button component
[x] Task 1.2: Created useAuth hook
[ ] Task 2: Integrating... (in progress)
[ ] Task 3.1: Pending
[ ] Task 3.2: Pending
```

## Output During Implementation

After each parallel group:

```markdown
## Group 1 Complete

### Results

- [x] Task 1.1: Created src/components/Button.tsx
- [x] Task 1.2: Created src/hooks/useAuth.ts

### Verification

- Type-check: ✓ passed
- Lint: ✓ passed

### Next

Starting Task 2 (depends on 1.1, 1.2)...
```

## Error Handling

If a sub-agent fails:

1. Report which task failed and why
2. Attempt fix directly
3. If blocked, pause and ask user

If verification fails:

1. Fix issues before proceeding
2. Re-run verification
3. Only continue when clean

## Checkpoint Triggers

Run /checkpoint if:

- Context getting long (many messages)
- Major milestone complete
- Unexpected complexity found
- Before starting new parallel group (good save point)

## Completion: Task Document

**Write to**: `.claude/work/tasks/implement-{slug}.md`

When all tasks done, write a self-contained summary:

```markdown
# Implementation: [Feature Name]

**Status**: Complete
**Date**: [YYYY-MM-DD]
**Input**: `plan-{slug}.md`
**Next step**: `/commit` or more work

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint passing

## Files Changed

| File                      | Action   | Purpose |
| ------------------------- | -------- | ------- |
| src/components/Button.tsx | Created  | ...     |
| src/hooks/useAuth.ts      | Created  | ...     |
| src/app/layout.tsx        | Modified | ...     |

## Task Completion Log

- [x] Task 1.1: [Title] - [Brief outcome]
- [x] Task 1.2: [Title] - [Brief outcome]
- [x] Task 2: [Title] - [Brief outcome]
      ...

## Issues Encountered

[Any problems and how they were resolved]

## Next Step

Run `/commit` to commit changes, or continue with more work.
```

## Rules

- MAX 5 parallel sub-agents
- VERIFY after each parallel group
- FIX issues before proceeding
- UPDATE TodoWrite in real-time
- NO skipping verification steps

## Archive Completed Work

After successful implementation, archive both the story and implementation files:

```bash
# Archive story file
mkdir -p .claude/work/tasks/stories/done
mv .claude/work/tasks/stories/{story-file}.md .claude/work/tasks/stories/done/

# Archive implementation file
mkdir -p .claude/work/tasks/done
mv .claude/work/tasks/implement-{slug}.md .claude/work/tasks/done/
```

This keeps the working folders clean and provides a record of completed work.

## Transition

When implementation is complete:

1. Write the task doc to `.claude/work/tasks/implement-{slug}.md`
2. Archive the story file to `.claude/work/tasks/stories/done/`
3. Archive the implementation file to `.claude/work/tasks/done/`
4. Tell user: "Implementation complete and archived. Run `/commit` to commit, or continue working."
