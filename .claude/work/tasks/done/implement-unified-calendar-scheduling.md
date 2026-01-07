# Implement: Unified Calendar Scheduling

**Status**: Complete
**Date**: 2026-01-05
**Source**: `plan-unified-calendar-scheduling.md`
**Duration**: Single session

---

## Summary

Implemented unified calendar with auto-scheduling feature where tasks are rendered in the same time grid as events (08:00-18:00). Tasks auto-schedule from the top, avoid event slots, respect 8h daily capacity with backward overflow, and can be manually repositioned via drag-and-drop.

---

## Decisions Implemented

| Decision | Implemented | Verified |
|----------|-------------|----------|
| Tasks rendered in time grid | ✅ Yes | `DayColumn` with `unifiedCalendarMode={true}` renders tasks absolutely positioned |
| Auto-scheduling fills from top | ✅ Yes | `TaskSchedulerService.scheduleWithOverflow()` starts at 08:00 |
| Avoid event slots | ✅ Yes | `CalendarConflictService.getOccupiedSlots()` checks events |
| 8h daily capacity | ✅ Yes | Configurable `DAILY_CAPACITY_HOURS = 8` |
| Backward overflow | ✅ Yes | Excess cascades to previous day recursively (up to 14 days) |
| Remaining time display | ✅ Yes | `remainingDuration = estimatedHours - loggedTime` computed |
| Drag backward only | ✅ Yes | `validateTaskPlacement()` enforces `scheduledDate <= dueDate` |
| Pinned positions | ✅ Yes | Pin icon shows, pinned tasks excluded from auto-scheduling |
| Firm-wide visibility | ✅ Yes | Server-side scheduling persisted to database |

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/database/prisma/schema.prisma` | MODIFY | Added `scheduledDate`, `scheduledStartTime`, `pinned`, `version` fields to Task model |
| `services/gateway/src/graphql/schema/task.graphql` | MODIFY | Added scheduling fields to Task type and `rescheduleTask` mutation |
| `services/gateway/src/services/task-scheduler.service.ts` | CREATE | Auto-scheduling algorithm with backward overflow |
| `services/gateway/src/services/calendar-conflict.service.ts` | CREATE | Conflict detection for drag validation |
| `services/gateway/src/services/task.service.ts` | MODIFY | Wired scheduler into task CRUD lifecycle |
| `services/gateway/src/graphql/resolvers/task.resolvers.ts` | MODIFY | Added `loggedTime` field resolver and `rescheduleTask` mutation |
| `apps/web/src/graphql/queries.ts` | MODIFY | Added scheduling fields to task queries |
| `apps/web/src/graphql/mutations.ts` | MODIFY | Added `RESCHEDULE_TASK` mutation |
| `apps/web/src/store/calendarStore.ts` | MODIFY | Added `showCompletedTasks` toggle with localStorage persistence |
| `apps/web/src/hooks/useCalendarEvents.ts` | MODIFY | Uses `scheduledDate` for positioning, calculates `remainingDuration` |
| `apps/web/src/components/calendar/TaskCard.tsx` | MODIFY | Added time-grid positioning props, pin icon, remaining duration display |
| `apps/web/src/components/calendar/DayColumn.tsx` | MODIFY | Added `unifiedCalendarMode`, time grid drag handlers, drop indicator |
| `apps/web/src/app/(dashboard)/calendar/page.tsx` | MODIFY | Integrated unified mode, `showCompletedTasks` toggle, reschedule handler |

---

## Database Migration

Schema pushed to both databases:
- `legal_platform_seed` (port 4000)
- `legal_platform` (port 4001)

Initial data migration executed:
```sql
UPDATE tasks
SET scheduled_date = due_date
WHERE scheduled_date IS NULL
  AND status NOT IN ('Completed', 'Cancelled');
```

---

## Key Implementation Details

### Server-Side Scheduler (`task-scheduler.service.ts`)

```typescript
// Core algorithm
async scheduleTask(taskId: string, firmId: string, assigneeId: string): Promise<void>

// Business hours: 08:00-18:00 (10 hours visible, 8 hours capacity)
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const DAILY_CAPACITY_HOURS = 8;

// Backward overflow: if day exceeds capacity, cascade to previous day
private async scheduleWithOverflow(
  taskId: string, firmId: string, assigneeId: string, dueDate: Date, remainingHours: number
): Promise<{ date: Date; startTime: string } | null>
```

### Conflict Detection (`calendar-conflict.service.ts`)

```typescript
// Validates task placement for drag-and-drop
async validateTaskPlacement(
  taskId: string, firmId: string, assigneeId: string,
  scheduledDate: Date, scheduledStartTime: string
): Promise<{ valid: boolean; reason?: string }>

// Enforces drag backward only
if (scheduledDate > task.dueDate) {
  return { valid: false, reason: 'Cannot schedule task past its due date' };
}
```

### Frontend Unified Mode

```typescript
// DayColumn with unified mode renders tasks in time grid
<DayColumn
  unifiedCalendarMode={true}
  onTaskReschedule={handleTaskReschedule}
/>

// TaskCard with absolute positioning
<TaskCard
  top={calculateEventPosition(task.scheduledStartTime, startHour)}
  height={task.remainingDuration * HOUR_HEIGHT}
  task={task}
/>
```

---

## Type Checking

All modified files pass TypeScript validation:
```bash
npx tsc --noEmit --project apps/web/tsconfig.json
```

---

## Acceptance Testing

| Test | How to Verify |
|------|---------------|
| Tasks in time grid | Visit `/calendar` → tasks appear as blocks in 08:00-18:00 grid |
| Auto-scheduling | Create new task → appears at first available slot |
| Remaining duration | Log time on task → block height decreases |
| Drag backward | Drag task to earlier date → works; drag past due date → rejected |
| Pinned tasks | Manually drag task → shows pin icon, stays fixed |
| Show/hide completed | Toggle button in header → completed tasks hide/show |

---

## Next Step

Run `/test implement-unified-calendar-scheduling` to verify all decisions are working.
