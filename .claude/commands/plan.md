# /plan - Task Breakdown with Parallelization

**Purpose**: Break work into smallest tasks that implement the Decisions.
**Mode**: Semi-collaborative (Claude proposes, user approves/adjusts)
**Input**: `.claude/work/tasks/research-{slug}.md`
**Output**: `.claude/work/tasks/plan-{slug}.md`

## Invocation

```
/plan research-{slug}
```

## Auto-load Context (first step)

```
Read: .claude/work/tasks/research-{slug}.md → Decisions + research findings
```

---

## Execution Steps

### 1. Review Decisions

First, review the Decisions section from research doc. Every task must trace back to a Decision.

### 2. Decompose into Atomic Tasks

Break work into smallest independent units:

- Each task = one logical change
- Each task = clear done criteria
- Each task = maps to one or more Decisions

### 3. Identify Parallel Groups

Group tasks by file ownership:

```
Rule: No two parallel tasks touch the same file
```

Analyze dependencies:

- Task B needs Task A's output? → Sequential
- Task B and C are independent? → Parallel

### 4. Get User Approval

Present the plan and get explicit approval before writing.

---

## Output: Task Document

**Write to**: `.claude/work/tasks/plan-{slug}.md`

```markdown
# Plan: [Feature Name]

**Status**: Pending Approval
**Date**: [YYYY-MM-DD]
**Input**: `research-{slug}.md`
**Next step**: `/implement plan-{slug}`

---

## Problem Statement

[Copy from research - unchanged]

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

### Functional Decisions

[Copy table exactly]

### Technical Decisions

[Copy table exactly]

### Out of Scope

[Copy exactly - remind implementer what NOT to do]

---

## Implementation Approach

[One paragraph summary of how we're implementing the Decisions, based on research]

---

## Tasks

### Parallel Group 1

> These tasks run simultaneously via sub-agents

#### Task 1.1: [Title]

- **Implements**: [Which Decision(s) this addresses]
- **File**: src/path/to/file.tsx (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

#### Task 1.2: [Title]

- **Implements**: [Which Decision(s)]
- **File**: src/path/to/other.ts (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

---

### Sequential: After Group 1

#### Task 2: [Title]

- **Implements**: [Which Decision(s)]
- **Depends on**: Task 1.1, 1.2
- **File**: src/path/to/dependent.tsx
- **Do**: [Specific instructions]
- **Done when**: [Acceptance criteria]

---

### Parallel Group 2

> These tasks run simultaneously via sub-agents

#### Task 3.1: [Title]

...

---

### Final: Integration & Verification

#### Task N: Wire Together & Test

- **Do**: Connect all pieces, verify all Decisions are implemented
- **Done when**: Feature works end-to-end per Decisions

---

## Decision Coverage Check

| Decision                   | Implemented by Task(s) |
| -------------------------- | ---------------------- |
| [Each decision from above] | Task X.X, Task Y.Y     |

## Session Scope

- **Total tasks**: X
- **Complexity**: [Simple/Medium/Complex]

---

## Next Step

After approval, start a new session and run:
`/implement plan-{slug}`
```

---

## Rules

- EVERY task must map to a Decision (no scope creep)
- NO tasks for things in "Out of Scope"
- MAX 5 tasks per parallel group
- EXCLUSIVE file ownership per task in parallel groups
- GET user approval before writing task doc

## Transition

When user approves:

1. Update status to "Approved"
2. Write the task doc to `.claude/work/tasks/plan-{slug}.md`
3. Tell user: "Plan saved. Start a new session and run `/implement plan-{slug}`"
