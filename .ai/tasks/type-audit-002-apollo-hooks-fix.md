# Task: Fix Apollo Client / React Query API Mixing

**ID:** type-audit-002
**Priority:** P0 (Critical)
**Estimated Time:** 20 minutes
**Dependencies:** None

---

## Problem

Two hooks incorrectly import `useQueryClient` from `@apollo/client` (doesn't exist) and use React Query's `onSuccess` callback pattern instead of Apollo's `onCompleted`.

## Files to Modify

| File | Action |
|------|--------|
| `apps/web/src/hooks/useTaskTemplates.ts` | Fix imports and mutation callbacks |
| `apps/web/src/hooks/useTaskDependencies.ts` | Fix imports and mutation callbacks |

---

## Fix: useTaskTemplates.ts

### Step 1: Fix imports (line 1)

```typescript
// FROM:
import { useQuery, useMutation, useQueryClient } from '@apollo/client';

// TO:
import { useQuery, useMutation } from '@apollo/client';
```

### Step 2: Fix all mutation hooks

Replace `onSuccess` with `refetchQueries`. There are 5 mutations to fix:

**useCreateTemplate (lines 251-265):**
```typescript
// FROM:
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const [mutate, { data, loading, error }] = useMutation(CREATE_TASK_TEMPLATE, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskTemplates'] });
    },
  });
  // ...
}

// TO:
export function useCreateTemplate() {
  const [mutate, { data, loading, error }] = useMutation(CREATE_TASK_TEMPLATE, {
    refetchQueries: [{ query: GET_TASK_TEMPLATES }],
  });
  // ...
}
```

**useUpdateTemplate (lines 268-282):**
```typescript
// TO:
export function useUpdateTemplate() {
  const [mutate, { data, loading, error }] = useMutation(UPDATE_TASK_TEMPLATE, {
    refetchQueries: [{ query: GET_TASK_TEMPLATES }],
  });
  // ...
}
```

**useDeleteTemplate (lines 285-299):**
```typescript
// TO:
export function useDeleteTemplate() {
  const [mutate, { data, loading, error }] = useMutation(DELETE_TASK_TEMPLATE, {
    refetchQueries: [{ query: GET_TASK_TEMPLATES }],
  });
  // ...
}
```

**useDuplicateTemplate (lines 302-316):**
```typescript
// TO:
export function useDuplicateTemplate() {
  const [mutate, { data, loading, error }] = useMutation(DUPLICATE_TASK_TEMPLATE, {
    refetchQueries: [{ query: GET_TASK_TEMPLATES }],
  });
  // ...
}
```

**useApplyTemplate (lines 319-334):**
```typescript
// TO:
export function useApplyTemplate() {
  const [mutate, { data, loading, error }] = useMutation(APPLY_TEMPLATE, {
    refetchQueries: ['tasks', 'taskDependencies'],
  });
  // ...
}
```

---

## Fix: useTaskDependencies.ts

### Step 1: Fix imports (line 1)

```typescript
// FROM:
import { useQuery, useMutation, useQueryClient } from '@apollo/client';

// TO:
import { useQuery, useMutation } from '@apollo/client';
```

### Step 2: Fix all mutation hooks

**useAddDependency (lines 254-276):**
```typescript
// FROM:
export function useAddDependency() {
  const queryClient = useQueryClient();
  const [mutate, { data, loading, error }] = useMutation(ADD_TASK_DEPENDENCY, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskDependencies'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  // ...
}

// TO:
export function useAddDependency() {
  const [mutate, { data, loading, error }] = useMutation(ADD_TASK_DEPENDENCY, {
    refetchQueries: ['taskDependencies', 'tasks'],
  });
  // ...
}
```

**useRemoveDependency (lines 279-294):**
```typescript
// TO:
export function useRemoveDependency() {
  const [mutate, { data, loading, error }] = useMutation(REMOVE_TASK_DEPENDENCY, {
    refetchQueries: ['taskDependencies', 'tasks'],
  });
  // ...
}
```

**useApplyCascade (lines 309-325):**
```typescript
// TO:
export function useApplyCascade() {
  const [mutate, { data, loading, error }] = useMutation(APPLY_DEADLINE_CASCADE, {
    refetchQueries: ['tasks', 'taskDependencies', 'criticalPath'],
  });
  // ...
}
```

**useRecalculateCriticalPath (lines 328-343):**
```typescript
// TO:
export function useRecalculateCriticalPath() {
  const [mutate, { data, loading, error }] = useMutation(RECALCULATE_CRITICAL_PATH, {
    refetchQueries: ['criticalPath', 'tasks'],
  });
  // ...
}
```

---

## Verification

```bash
cd apps/web
npx tsc --noEmit
```

Expected: No errors about `useQueryClient` export or `onSuccess` property.

## Notes

- Apollo Client uses `refetchQueries` to invalidate cache after mutations
- Can use query document reference or operation name string
- `onCompleted` is available for side effects but not needed for cache invalidation
