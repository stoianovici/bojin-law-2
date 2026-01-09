# /implement - Parallel Execution

**Purpose**: Execute tasks, parallelizing where possible.
**Mode**: Autonomous with progress updates
**Input**: `plan-{slug}.md` OR `ideate-{slug}.md` (for simple work)
**Output**: Working code + `.claude/work/tasks/implement-{slug}.md`

## Invocation

```
/implement plan-{slug}     # From a plan
/implement ideate-{slug}   # Direct from ideate (simple work)
```

## Auto-load Context

```
Read: .claude/work/tasks/plan-{slug}.md → Decisions + tasks
  OR: .claude/work/tasks/ideate-{slug}.md → Decisions + approach
```

---

## Execution Strategy

### Before Starting

Review the Decisions section. These are the requirements. Do not deviate.

### From Plan: Follow Task Groups

Execute tasks as specified:

- Parallel groups → spawn up to 3 sub-agents
- Sequential tasks → execute directly
- Verify after each group before continuing

### From Ideate (no plan): Linear Execution

Work through Decisions one by one:

1. Implement Decision 1
2. Verify it works
3. Implement Decision 2
4. Continue until done

---

## Sub-agent Protocol (for parallel work)

**Max 3 agents per group** - more causes coordination issues.

Each agent receives:

```
## Your Task
[Task description]

## File (exclusive ownership)
[Only this file - no touching others]

## Decisions You Must Follow
[Full Decisions table from plan/ideate]

## Constraints
- Only modify your assigned file
- Follow existing code patterns
- Implement exactly what Decisions specify
```

---

## After Each Group

1. **Verify agents completed** - all tasks done?
2. **Type-check** - `pnpm type-check` on changed files
3. **Integration check**:
   - [ ] Component imported in parent?
   - [ ] Rendered in JSX (not just imported)?
   - [ ] Props wired (no stubs like `() => {}`)?
   - [ ] GraphQL fields included in queries?
4. **Functional check** - does each "Done when" criteria pass?
5. **Fix issues** before next group

---

## Progress Tracking

Use TodoWrite throughout:

```
[x] Task 1.1: Create EmailList component
[x] Task 1.2: Add useEmailThread hook
[ ] Task 2: Wire into CaseEmailTab - in progress
[ ] Task 3: Integration test
```

Report after each group:

```markdown
## Group 1 Complete

- [x] Task 1.1: Created src/components/EmailList.tsx
- [x] Task 1.2: Created src/hooks/useEmailThread.ts

Verification: Types ✓ | Lint ✓ | Integration ✓

Starting Task 2...
```

---

## Checkpoint Triggers

Use `/checkpoint` if:

- Context getting long (many messages)
- Major milestone complete
- Unexpected complexity found
- Before starting a new parallel group

---

## Error Handling

**Sub-agent fails:**

1. Report which task failed
2. Attempt fix directly
3. If blocked → ask user

**Verification fails:**

1. Fix before proceeding
2. Re-verify
3. Only continue when clean

**Conflicts with Decisions:**

1. STOP
2. Report the conflict
3. Ask user how to proceed

---

## Completion

**Write to**: `.claude/work/tasks/implement-{slug}.md`

```markdown
# Implement: [Feature Name]

**Date**: YYYY-MM-DD | **Status**: Complete

## Summary

- [x] All Decisions implemented
- [x] Types passing
- [x] Lint passing

## Decisions Status

| Decision | Status | File              |
| -------- | ------ | ----------------- |
| [Name]   | Done   | src/path/file.tsx |

## Files Changed

| File    | Action   | Decision |
| ------- | -------- | -------- |
| src/... | Created  | X        |
| src/... | Modified | Y        |

## Task Log

- [x] Task 1.1: [outcome]
- [x] Task 1.2: [outcome]
- [x] Task 2: [outcome]

## Issues

[Problems encountered and how resolved, or "None"]
```

---

## Rules

- **Max 3 sub-agents** per parallel group
- Every agent gets the Decisions section
- No implementing things outside Decisions
- No skipping things in Decisions
- Verify after each group
- Check for stub callbacks (`() => {}`) - not complete
- Stop if Decisions conflict with reality

## Transition

When complete:

1. Write implementation doc
2. Run `/test implement-{slug}` to verify
3. Or `/iterate` for visual inspection first

**Do NOT skip /test** - it catches integration gaps.

## Workflow

```
/ideate → /plan (optional) → /implement → /test → /commit
                                  ↑
                            checkpoint as needed
```
