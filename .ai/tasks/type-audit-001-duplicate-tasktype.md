# Task: Fix Duplicate TaskType Export

**ID:** type-audit-001
**Priority:** P0 (Critical)
**Estimated Time:** 5 minutes
**Dependencies:** None

---

## Problem

`TaskType` is exported from two files, causing a collision when both are re-exported from `index.ts`.

## Files to Modify

| File | Action |
|------|--------|
| `packages/shared/types/src/task-dependencies.ts` | Remove duplicate, update import |

## Current State

**File:** `packages/shared/types/src/task-dependencies.ts`

Line 3 - Current import:
```typescript
import { Task, CaseType } from './entities';
```

Lines 196-202 - Duplicate definition (REMOVE THIS):
```typescript
export type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';
```

## Required Changes

### Step 1: Update import on line 3

```typescript
// FROM:
import { Task, CaseType } from './entities';

// TO:
import { Task, CaseType, TaskType } from './entities';
```

### Step 2: Delete lines 196-202

Remove the entire duplicate `TaskType` definition block.

## Verification

```bash
cd packages/shared/types
npx tsc --noEmit
```

Expected: No errors related to duplicate `TaskType` exports.

## Notes

- `entities.ts` is the canonical source for `TaskType`
- `task-types.ts` already correctly imports from `entities.ts`
