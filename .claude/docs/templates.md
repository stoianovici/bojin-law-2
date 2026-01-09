# Document Templates

Lightweight templates for workflow documents. Emphasis on decisions and traceability, not prose.

---

## Ideate Output

```markdown
# Ideate: [Topic]

**Date**: YYYY-MM-DD | **Next**: /plan or /implement

## Problem

[2-3 sentences max]

## Decisions

| What | How | Verify                  |
| ---- | --- | ----------------------- |
| ...  | ... | User does X → Y happens |

### Out of Scope

- [Not doing]

## Files

| File | Action        | Decision       |
| ---- | ------------- | -------------- |
| path | Create/Modify | Which decision |

## Patterns

- [file:line] - [what pattern to follow]

## Risks

| Risk | Mitigation |
| ---- | ---------- |
```

---

## Plan Output

```markdown
# Plan: [Topic]

**Date**: YYYY-MM-DD | **Input**: ideate-{slug}.md

## Tasks

### Group 1 (parallel)

- [ ] **Task 1.1**: [Decision name] → [file] → [what to do]
- [ ] **Task 1.2**: [Decision name] → [file] → [what to do]

### Sequential

- [ ] **Task 2**: [Decision name] → depends on 1.1, 1.2

### Group 2 (parallel)

- [ ] **Task 3.1**: ...

## Decision Coverage

| Decision | Task(s)  |
| -------- | -------- |
| Each one | Must map |
```

---

## Implementation Log

```markdown
# Implement: [Topic]

**Date**: YYYY-MM-DD | **Status**: Complete/In Progress

## Done

- [x] Task 1.1 → created src/path/file.tsx
- [x] Task 1.2 → modified src/path/other.ts

## In Progress

- [ ] Task 2 → at [specific point]

## Issues

[Any problems encountered and how resolved]

## Verification

- [ ] Types pass
- [ ] Lint passes
- [ ] Each Decision verified (Verify column)
```

---

## Checkpoint

```markdown
# Checkpoint: [Name]

**Created**: YYYY-MM-DD HH:MM | **Goal**: [one line]

## Context

[2-3 sentences]

## Decisions

| Decision | Details |
| -------- | ------- |

## Progress

- [x] Done
- [ ] In progress - at [point]
- [ ] Pending

## Files

| File | Status | Notes |
| ---- | ------ | ----- |

## Resume

**First action**: [specific next step]
```

---

## Design Principles

1. **Tables over prose** - scannable, structured
2. **Decisions are the contract** - everything traces back
3. **Verify column is mandatory** - no decision without a test
4. **File:line references** - precise, searchable
5. **Status is binary** - done or not done, not "mostly done"
