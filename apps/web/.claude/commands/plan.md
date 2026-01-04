# /plan - Task Breakdown with Parallelization

**Purpose**: Break work into smallest tasks, identify parallel groups, get user approval.
**Mode**: Semi-collaborative (Claude proposes, user approves/adjusts)
**Input**: `.claude/work/tasks/research-{slug}.md`
**Output**: `.claude/work/tasks/plan-{slug}.md`

## Invocation

```
/plan research-{slug}
```

## Auto-load Context (first step)

```
Read: .claude/work/tasks/research-{slug}.md → Full context from research phase
```

The research doc contains project context, findings, file plan, and recommendations. No other context loading needed.

---

## Inputs (from research doc)

- Project context and tech stack
- Research findings with file plan
- Implementation recommendation

## Execution Steps

### 1. Decompose into Atomic Tasks

Break work into smallest independent units:

- Each task = one logical change
- Each task = clear done criteria
- Each task = testable independently

### 2. Identify Parallel Groups

Group tasks by file ownership:

```
Rule: No two parallel tasks touch the same file
```

Analyze dependencies:

- Task B needs Task A's output? → Sequential
- Task B and C are independent? → Parallel

### 3. Create Execution Plan

## Output: Task Document

**Write to**: `.claude/work/tasks/plan-{slug}.md`

The task doc must be **self-contained** for a fresh session. Include:

```markdown
# Plan: [Feature Name]

**Status**: Approved
**Date**: [YYYY-MM-DD]
**Input**: `research-{slug}.md`
**Next step**: `/implement plan-{slug}`

---

## Context Summary

[Condensed from research: project path, tech stack, key patterns]

## Approach Summary

[One paragraph on what we're building and how]

---

## Parallel Group 1

> These tasks run simultaneously via sub-agents

### Task 1.1: [Title]

- **File**: src/path/to/file.tsx (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

### Task 1.2: [Title]

- **File**: src/path/to/other.ts (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

---

## Sequential: After Group 1

### Task 2: [Title]

- **Depends on**: Task 1.1, 1.2
- **File**: src/path/to/dependent.tsx
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

---

## Parallel Group 2

> These tasks run simultaneously via sub-agents

### Task 3.1: [Title]

...

---

## Final Steps (Sequential)

### Task N: Integration & Testing

- **Do**: Wire everything together, run tests
- **Done when**: All tests pass, feature works end-to-end

---

## Session Scope Assessment

- **Total tasks**: X
- **Estimated complexity**: [Simple/Medium/Complex]
- **Checkpoint recommended at**: [Task X if complex]

## Next Step

Start a new session and run:
`/implement plan-{slug}`
```

## Rules

- MAX 5 tasks per parallel group (sub-agent limit)
- EXCLUSIVE file ownership per task in parallel groups
- CLEAR boundaries - no ambiguity on what each task does
- GET user approval before writing task doc

## Transition

When user approves:

1. Write the task doc to `.claude/work/tasks/plan-{slug}.md`
2. Tell user: "Plan saved to `plan-{slug}.md`. Start a new session and run `/implement plan-{slug}`"
