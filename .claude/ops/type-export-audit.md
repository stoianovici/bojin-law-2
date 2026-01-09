# Type Export Audit

**Created:** 2025-12-01
**Status:** Tasks Created - Ready for Assignment

---

## Task Index

| Task ID                                            | Priority | Description                       | Est. Time | Status |
| -------------------------------------------------- | -------- | --------------------------------- | --------- | ------ |
| [001](tasks/type-audit-001-duplicate-tasktype.md)  | P0       | Fix duplicate TaskType export     | 5 min     | Open   |
| [002](tasks/type-audit-002-apollo-hooks-fix.md)    | P0       | Fix Apollo/React Query API mixing | 20 min    | Open   |
| [003](tasks/type-audit-003-legacy-import-paths.md) | P1       | Fix legacy-import module paths    | 30 min    | Open   |
| [004](tasks/type-audit-004-implicit-any-types.md)  | P2       | Fix implicit any types            | 45 min    | Open   |
| [005](tasks/type-audit-005-error-type-handling.md) | P2       | Fix unknown error type handling   | 20 min    | Open   |

---

## Execution Order

```
001 ─┬─► 003 ─► 004 ─► 005
     │
002 ─┘
```

- **001** and **002** can run in parallel (no dependencies)
- **003** must complete before **004** and **005** (path resolution needed first)
- **004** and **005** can run in parallel after **003**

---

## Quick Summary

### P0 - Critical (Blocking)

1. **Duplicate TaskType** - `task-dependencies.ts` re-exports `TaskType` that's already in `entities.ts`
2. **Apollo/RQ Mixing** - `useQueryClient` imported from wrong package, `onSuccess` should be `refetchQueries`

### P1 - High

3. **Module Paths** - 78+ errors in `apps/legacy-import` due to `@/*` aliases not resolving

### P2 - Medium

4. **Implicit Any** - 50+ callback parameters need type annotations
5. **Error Handling** - 10+ catch blocks need `instanceof Error` checks

---

## Verification Command

After all tasks complete:

```bash
npx tsc --noEmit
```

Expected: 0 errors (excluding any pre-existing unrelated issues)

---

## Notes for Dev Agents

- Each task file contains exact line numbers and code changes
- Follow the fix patterns exactly as documented
- Run verification command after each task
- Update task status in this file when complete
