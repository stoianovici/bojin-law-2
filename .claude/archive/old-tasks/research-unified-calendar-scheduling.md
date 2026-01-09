# Research: Unified Calendar with Auto-Scheduling

**Status**: Complete
**Date**: 2026-01-05
**Input**: `brainstorm-unified-calendar-scheduling.md`
**Next step**: `/plan research-unified-calendar-scheduling`

---

## Problem Statement

The calendar currently displays tasks and events in separate visual areas - events in the time grid, tasks in a bottom panel. We need to unify them into a single business hours view where tasks are auto-scheduled around fixed events, with overflow cascading to previous days when a day is overbooked.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision               | Details                                                                  | Rationale                                             | Verify                                                          |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| Tasks in time grid     | Tasks render as blocks in the 08:00-18:00 grid, same as events           | Unified view shows true workload                      | Open calendar → tasks appear in time slots, not in bottom panel |
| Fill from top          | Tasks auto-position starting at day's first available slot (e.g., 09:00) | Natural reading order, fills day progressively        | Create 3 tasks → they stack from morning downward               |
| Avoid event slots      | Auto-scheduler skips time slots occupied by fixed events                 | Events are immovable commitments                      | Create event 10:00-11:00, add task → task schedules around it   |
| 8h daily capacity      | Business day = 8 working hours (configurable later)                      | Standard workday, prevents overcommitment             | Add 10h of tasks to one day → 2h overflow to previous day       |
| Backward overflow      | When day exceeds capacity, excess tasks cascade to previous day          | Deadline integrity - work must happen before due date | Friday has 10h work → 2h auto-scheduled to Thursday             |
| Cascade recursively    | If previous day also full, continue cascading backward                   | Handles multi-day overload                            | Mon-Fri all have 10h → work spreads across week                 |
| Remaining time display | Task block height = estimatedDuration - loggedTime                       | Shows actual remaining work                           | 4h task with 1h logged → displays as 3h block                   |
| Drag backward only     | Tasks can be dragged to same day or earlier, never past due date         | Preserves deadline integrity                          | Drag task past due date → snaps back / rejected                 |
| Pinned positions       | Dragged tasks save their position, scheduler works around them           | Manual override when auto-schedule isn't ideal        | Drag task to 14:00 → stays at 14:00 after new tasks added       |
| Firm-wide visibility   | Scheduled positions are persisted and visible to all team members        | Partners need to see associate workload               | User A schedules task → User B sees same position               |
| Trigger on task change | Auto-scheduler runs on task create/update/complete/delete                | Always current, no manual refresh needed              | Create task → calendar updates immediately with new positions   |

### Technical Decisions

| Decision                | Details                                                                            | Rationale                                             | Verify                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| New Task fields         | Add `scheduledDate: Date?` and `scheduledStartTime: String?` (HH:MM) to Task model | Persist calculated positions for firm-wide visibility | Query task → returns scheduledDate and scheduledStartTime            |
| Server-side scheduler   | Auto-scheduling algorithm runs on gateway, not client                              | Consistent results, handles concurrent edits          | Two users add tasks simultaneously → both see consistent schedule    |
| Remaining duration calc | `remainingDuration = estimatedDuration - SUM(timeEntries.duration)`                | Accurate work remaining                               | Task with time entries → calendar shows reduced block                |
| Visual distinction      | Tasks use purple/orange/red left border (existing), events use type-based colors   | Easy to distinguish task vs event at a glance         | View calendar → tasks and events visually distinct                   |
| Drag validation         | Frontend allows drag to valid slots only; server validates on save                 | UX + data integrity                                   | Drag to invalid slot → visual rejection + server rejects if bypassed |

### Out of Scope

- Priority-based scheduling (which tasks overflow first) - all tasks equal for now
- Weekend/holiday handling - assume Mon-Fri business days
- Partial-day capacity (e.g., half-day Friday) - full 8h per day
- Multi-assignee tasks - one owner per task
- Time-of-day preferences (e.g., "mornings only") - fills from top uniformly
- Undo/redo for schedule changes

---

## Research Findings

### Open Questions - Answered

| Question                                                                   | Answer                                                       | Evidence                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to handle initial migration - what `scheduledDate` for existing tasks? | Set `scheduledDate = dueDate` for non-completed tasks        | Migration script: `UPDATE tasks SET scheduled_date = due_date WHERE status NOT IN ('Completed', 'Cancelled')`. This preserves existing intent while enabling new scheduling. |
| Concurrent edit handling - optimistic locking?                             | Add `version: Int` field for optimistic locking              | Schema has `updatedAt` but no locking. Pattern: `WHERE id = ? AND version = ?`, increment on update, return conflict on mismatch.                                            |
| Performance with 100+ tasks per week - batch calculation?                  | Denormalize into `scheduledDate` field + add composite index | Current fetches 500 tasks at once. Add index on `(firmId, scheduledDate, status)`. Cache scheduler results with 30-min TTL.                                                  |
| How does filtering by team member interact with scheduling?                | Scheduling respects assignee; filter applied client-side     | `calendarStore.ts` has `selectedTeamMembers[]`. Pass `assigneeIds` to server query for efficiency. Schedule only considers filtered members' availability.                   |
| Should completed tasks still show in calendar?                             | Add toggle; default show greyed out, option to hide          | No toggle exists. Add `showCompletedTasks: boolean` to calendarStore. Completed tasks never block scheduling slots.                                                          |
| What happens to pinned task if event created in its slot?                  | Add conflict detection; warn user before event creation      | No validation exists. Create `calendar-conflict.service.ts` to check overlaps. Return warning with conflicting task details.                                                 |

### Existing Code Analysis

| Category        | Files                          | Notes                                                                                                          |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Reuse as-is** | `DayColumn.tsx:56-84`          | `parseTime()`, `calculateEventPosition()`, `calculateEventHeight()` - exact formulas for time→pixel conversion |
| **Reuse as-is** | `DayColumn.tsx:61`             | `HOUR_HEIGHT = 48` constant - pixels per hour                                                                  |
| **Reuse as-is** | `TaskCard.tsx:35-64`           | Variant styling (on-track/due-today/overdue/locked) - visual distinction already exists                        |
| **Reuse as-is** | `calendarStore.ts`             | Filter state management with localStorage persistence                                                          |
| **Modify**      | `useCalendarEvents.ts:180-219` | Transform logic separates events/tasks - needs to use `scheduledStartTime` for positioning                     |
| **Modify**      | `DayColumn.tsx:264-296`        | Tasks area is separate flex container - move tasks into time grid                                              |
| **Modify**      | `task.service.ts`              | Add scheduler integration after create/update                                                                  |
| **Modify**      | `task.resolvers.ts:167-195`    | Call scheduler service after task mutations                                                                    |
| **Modify**      | `schema.prisma:2121-2193`      | Task model - add `scheduledDate`, `scheduledStartTime`, `pinned`, `version`                                    |
| **Create new**  | `task-scheduler.service.ts`    | Core scheduling algorithm                                                                                      |
| **Create new**  | `calendar-conflict.service.ts` | Overlap detection for events vs pinned tasks                                                                   |

### Patterns Discovered

**Time-to-Pixel Conversion** (`DayColumn.tsx:67-84`):

```typescript
const HOUR_HEIGHT = 48; // pixels per hour

function calculateEventPosition(startTime: string, startHour: number): number {
  const { hours, minutes } = parseTime(startTime);
  const hoursFromStart = hours - startHour;
  return hoursFromStart * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

function calculateEventHeight(startTime: string, endTime: string): number {
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  const durationMinutes = endMinutes - startMinutes;
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24); // min 24px
}
```

**Drag-and-Drop Pattern** (`DayColumn.tsx:135-159`, `TaskCard.tsx:115-125`):

```typescript
// TaskCard sets data
e.dataTransfer.setData('text/plain', task.id);

// DayColumn receives
const taskId = e.dataTransfer.getData('text/plain');
onTaskDrop(taskId, date);

// Lock check prevents drag
if (isLocked) {
  e.preventDefault();
  return;
}
```

**Task Variant Styling** (`TaskCard.tsx:35-50`):

- `on-track`: Purple left border
- `due-today`: Orange left border
- `overdue`: Red left border + red background tint
- `locked`: Red border, cursor-not-allowed, lock icon

**Duration Formatting** (`useCalendarEvents.ts:116-123`):

```typescript
function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}
```

### Constraints Found

- **HOUR_HEIGHT = 48px** - Reduced from 60 to fit more hours on screen. 8-hour day = 384px grid height.
- **Minimum block height = 24px** - Events shorter than 30min still visible.
- **Tasks currently in separate container** - Need to move into absolute-positioned time grid.
- **No remaining duration calc** - Frontend shows `estimatedDuration`, not `estimatedDuration - loggedTime`.
- **Time entries relation exists** - `Task.timeEntries[]` with `hours: Decimal` field available for calc.

---

## Implementation Recommendation

### Scheduler Algorithm (Server-Side)

```
Input:
  - taskId (task being scheduled)
  - firmId
  - assigneeId

Algorithm:
1. Get task: dueDate, estimatedHours, pinned, scheduledDate
2. If pinned=true AND scheduledDate set: return existing schedule (no change)

3. Calculate remaining duration:
   remainingHours = estimatedHours - SUM(timeEntries.hours WHERE taskId=task.id)

4. Get constraints for dueDate:
   - Fixed events: tasks WHERE typeMetadata.isEvent=true AND assignedTo=assigneeId AND date=dueDate
   - Pinned tasks: tasks WHERE pinned=true AND scheduledDate=dueDate AND id != taskId

5. Find slot on dueDate (fill from top):
   freeSlots = calculateFreeSlots(08:00-18:00, events, pinnedTasks)
   slot = findFirstSlotWithDuration(freeSlots, remainingHours)

6. If slot found on dueDate:
   return { scheduledDate: dueDate, scheduledStartTime: slot.startTime }

7. If no slot (day full):
   Calculate spillover = remainingHours - availableHoursOnDueDate
   Recursively schedule spillover on previousDay (dueDate - 1)
   Return { scheduledDate: previousDay, scheduledStartTime: slot.startTime }
```

### Backward Cascade Logic

```
function scheduleWithOverflow(task, date, remainingHours, maxRecursion=14):
  if maxRecursion <= 0: throw "Cannot schedule - no capacity in 2-week window"

  available = getAvailableHours(date, task.assigneeId)

  if available >= remainingHours:
    // Fits entirely on this day
    startTime = findFirstAvailableSlot(date, remainingHours)
    return { scheduledDate: date, scheduledStartTime: startTime }
  else:
    // Partial fit - overflow to previous day
    scheduledHours = available
    overflowHours = remainingHours - available

    // Schedule what fits today (from last available slot)
    startTime = findLastAvailableSlot(date, scheduledHours)

    // Recursively schedule overflow on previous day
    overflowSlot = scheduleWithOverflow(task, date-1, overflowHours, maxRecursion-1)

    // Return earliest scheduled position (the overflow portion)
    return overflowSlot
```

### Frontend Rendering Strategy

1. **Tasks with `scheduledStartTime`**: Render in time grid using existing `calculateEventPosition()` formula
2. **Tasks without `scheduledStartTime`**: Show in "Unscheduled" section (all-day row or separate panel)
3. **Remaining duration**: Calculate on frontend: `estimatedDuration - task.loggedTime` (add `loggedTime` to query)
4. **Block height**: `(remainingDuration / 60) * HOUR_HEIGHT` - same formula as events

---

## File Plan

| File                                                         | Action | Purpose                                                                      |
| ------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| `packages/database/prisma/schema.prisma`                     | Modify | Add `scheduledDate`, `scheduledStartTime`, `pinned`, `version` to Task model |
| `services/gateway/src/services/task-scheduler.service.ts`    | Create | Core scheduling algorithm with backward overflow                             |
| `services/gateway/src/services/calendar-conflict.service.ts` | Create | Detect overlaps between events and pinned tasks                              |
| `services/gateway/src/services/task.service.ts`              | Modify | Call scheduler after task create/update/complete                             |
| `services/gateway/src/graphql/schema/task.graphql`           | Modify | Add new fields to Task type and inputs                                       |
| `services/gateway/src/graphql/resolvers/task.resolvers.ts`   | Modify | Wire scheduler calls, add reschedule mutation                                |
| `apps/web/src/graphql/queries.ts`                            | Modify | Add `scheduledDate`, `scheduledStartTime`, `loggedTime` to task queries      |
| `apps/web/src/graphql/mutations.ts`                          | Modify | Update task input types                                                      |
| `apps/web/src/hooks/useCalendarEvents.ts`                    | Modify | Use `scheduledStartTime` for time-grid positioning, calc remaining duration  |
| `apps/web/src/components/calendar/DayColumn.tsx`             | Modify | Render tasks in time grid (absolute positioned), remove tasks-area container |
| `apps/web/src/components/calendar/TaskCard.tsx`              | Modify | Accept `height` prop for time-grid rendering, show remaining time            |
| `apps/web/src/store/calendarStore.ts`                        | Modify | Add `showCompletedTasks` toggle                                              |
| `apps/web/src/app/(dashboard)/calendar/page.tsx`             | Modify | Pass scheduled task data to DayColumn, handle drag-to-reschedule             |

---

## Risks

| Risk                                      | Mitigation                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Scheduler performance with 100+ tasks     | Denormalize into `scheduledDate` field; only recalculate affected tasks, not entire calendar |
| Concurrent edits cause schedule thrashing | Use optimistic locking with `version` field; queue rapid updates                             |
| Backward cascade creates infinite loop    | Set `maxRecursion=14` (2 weeks); error if can't schedule                                     |
| Tasks overflow to weekends                | Initially skip weekends (out of scope); handle as error if no capacity                       |
| Pinned tasks conflict with new events     | Warn user during event creation; allow override with explicit confirmation                   |
| Large time entries reduce task to 0 hours | Show minimum 15-min block; indicate "nearly complete" status                                 |

---

## Next Step

Start a new session and run:
`/plan research-unified-calendar-scheduling`
