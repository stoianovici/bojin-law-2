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

**CRITICAL: One Decision = One Task**

- Each task implements EXACTLY ONE decision (never multiple)
- Each task's "Done when" comes from the Decision's "Verify" column
- If a Decision is complex, split it into sub-decisions first

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

#### Task 1.1: [Decision name - copy verbatim from Decisions table]

- **Decision**: [Copy the FULL row: Decision | Details | Verify]
- **File**: src/path/to/file.tsx (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Copy from Decision's Verify column - must be observable behavior]

#### Task 1.2: [Decision name - copy verbatim]

- **Decision**: [Copy the FULL row]
- **File**: src/path/to/other.ts (CREATE/MODIFY)
- **Do**: [Specific instructions]
- **Done when**: [Copy from Verify column]

---

### Sequential: After Group 1

#### Task 2: [Decision name]

- **Decision**: [Copy the FULL row]
- **Depends on**: Task 1.1, 1.2
- **File**: src/path/to/dependent.tsx
- **Do**: [Specific instructions]
- **Done when**: [Copy from Verify column]

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

- **ONE DECISION = ONE TASK** (never bundle multiple decisions into one task)
- EVERY task must map to exactly ONE Decision (no scope creep)
- NO tasks for things in "Out of Scope"
- MAX 3 tasks per parallel group (better coordination)
- EXCLUSIVE file ownership per task in parallel groups
- "Done when" MUST come from Decision's Verify column (observable behavior)
- GET user approval before writing task doc

## Transition

When user approves:

1. Update status to "Approved"
2. Write the task doc to `.claude/work/tasks/plan-{slug}.md`
3. Tell user: "Plan saved. Start a new session and run `/implement plan-{slug}`"

## Full Workflow

```
/brainstorm → /research → /plan → /implement → /test → /commit
                                                  ↑       |
                                                  └─ fix ─┘
```
