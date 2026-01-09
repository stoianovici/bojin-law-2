# /plan - Task Breakdown

**Purpose**: Break work into parallel-safe tasks that implement the Decisions.
**Mode**: Semi-collaborative (Claude proposes, user approves)
**Input**: `.claude/work/tasks/ideate-{slug}.md`
**Output**: `.claude/work/tasks/plan-{slug}.md`

## Invocation

```
/plan ideate-{slug}
```

## When to Use

Use /plan when ideation produced 3+ files to change or complex dependencies.

**Skip /plan** if ideation shows:

- Only 1-2 files to modify
- Clear, linear implementation
- No parallel work needed

In that case, go directly to `/implement`.

---

## Auto-load Context

```
Read: .claude/work/tasks/ideate-{slug}.md → Decisions + approach
```

---

## Execution Steps

### 1. Review Decisions

Every task must trace back to a Decision from ideate. No scope creep.

### 2. Decompose into Tasks

**One Decision = One Task** (or split Decision if complex)

Each task needs:

- Which Decision it implements
- Which file it touches (exclusive ownership in parallel groups)
- What to do (specific)
- Done when (from Decision's Verify column)

### 3. Group for Parallelization

```
Rule: No two parallel tasks touch the same file
```

- Independent tasks → Parallel group
- Task B needs Task A → Sequential
- Max 3 tasks per parallel group

### 4. Get User Approval

Present plan, get explicit approval before proceeding.

---

## Output Format

**Write to**: `.claude/work/tasks/plan-{slug}.md`

```markdown
# Plan: [Feature Name]

**Date**: YYYY-MM-DD | **Input**: ideate-{slug}.md | **Status**: Pending Approval

## Decisions

| What | How | Verify |
| ---- | --- | ------ |

[Copy from ideate - this is the contract]

### Out of Scope

[Copy from ideate]

---

## Tasks

### Group 1 (parallel)

- [ ] **Task 1.1**: [Decision name]
  - File: `src/path/file.tsx` (CREATE/MODIFY)
  - Do: [specific instructions]
  - Done: [from Verify column]

- [ ] **Task 1.2**: [Decision name]
  - File: `src/path/other.ts` (CREATE/MODIFY)
  - Do: [specific instructions]
  - Done: [from Verify column]

### Sequential (after Group 1)

- [ ] **Task 2**: [Decision name]
  - Depends: Task 1.1, 1.2
  - File: `src/path/dependent.tsx`
  - Do: [specific instructions]
  - Done: [from Verify column]

### Group 2 (parallel)

- [ ] **Task 3.1**: ...

### Final: Integration

- [ ] **Task N**: Wire together, verify end-to-end
  - Done: All Decisions work per Verify criteria

---

## Decision Coverage

| Decision   | Task(s)    |
| ---------- | ---------- |
| [Each one] | [Must map] |

## Scope

- Tasks: X total
- Parallel groups: Y
- Complexity: Simple/Medium/Complex
```

---

## Rules

- **ONE DECISION = ONE TASK** (no bundling)
- Every task maps to a Decision (no extras)
- No tasks for "Out of Scope" items
- Max 3 tasks per parallel group
- Exclusive file ownership in parallel groups
- "Done" comes from Decision's Verify column
- Get user approval before writing

## Transition

When approved:

1. Update status to "Approved"
2. Write to `.claude/work/tasks/plan-{slug}.md`
3. Continue to `/implement plan-{slug}` (same session if context fresh, or `/checkpoint` first)

## Workflow

```
/ideate → /plan → /implement → /test → /commit
              ↑         ↓
              └─ checkpoint if needed
```
