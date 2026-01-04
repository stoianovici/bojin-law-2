# Story 05: Badge Component

**Parallelizable with**: All other Phase 1 stories (different files)
**Depends on**: Nothing
**Blocks**: None

---

## Task: Create Badge Component

**File**: `src/components/ui/Badge.tsx` (CREATE)

### Do

Create Badge component for status indicators with Linear styling:

```typescript
// Required exports:
export { Badge, getStatusBadgeVariant };
export type { BadgeProps, BadgeVariant };
```

**Variants**:

- `default` - `bg-linear-bg-tertiary text-linear-text-secondary`
- `success` - `bg-linear-success/10 text-linear-success`
- `warning` - `bg-linear-warning/10 text-linear-warning`
- `error` - `bg-linear-error/10 text-linear-error`
- `info` - `bg-linear-accent/10 text-linear-accent`

**Sizes**:

- `sm` - `text-[10px] px-1.5 py-0.5`
- `md` - `text-xs px-2 py-0.5` (default)

**Features**:

- Optional `dot` prop - Shows colored dot indicator before text
- Optional `icon` prop - Shows icon before text

**Styling**:

- `rounded-full` for pill shape
- `font-medium`
- `inline-flex items-center`

**Utility function** for case/task status mapping:

```typescript
export function getStatusBadgeVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    // Case statuses
    ACTIVE: 'success',
    PENDING: 'warning',
    CLOSED: 'default',
    ARCHIVED: 'default',

    // Task statuses
    TODO: 'default',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    BLOCKED: 'error',
    OVERDUE: 'error',

    // Document statuses
    DRAFT: 'default',
    IN_REVIEW: 'warning',
    CHANGES_REQUESTED: 'error',
    FINAL: 'success',
  };
  return map[status] || 'default';
}
```

### Example Usage

```tsx
<Badge>Default</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="error" dot>Overdue</Badge>
<Badge variant="info" size="sm">In Progress</Badge>
<Badge variant={getStatusBadgeVariant(case.status)}>{case.status}</Badge>
```

### Done when

- All variants render with correct colors
- Dot indicator shows when `dot` prop is true
- Size variants work
- Status mapping utility is correct
- Works inline with text
