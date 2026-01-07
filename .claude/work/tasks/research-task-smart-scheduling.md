# Research: Smart Task Scheduling in Calendar

**Status**: Complete
**Date**: 2026-01-06
**Input**: `brainstorm-task-smart-scheduling.md`
**Next step**: `/plan research-task-smart-scheduling`

---

## Problem Statement

Tasks in the calendar need intelligent auto-scheduling within business hours (9:00-18:00) that avoids conflicts with events and other tasks. Currently, tasks have `scheduledDate` and `scheduledStartTime` fields but no auto-positioning logic - they must be manually placed. We need automatic slot assignment on creation, smart conflict resolution, and intuitive drag-drop behavior with role-based permissions.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from brainstorm doc.
> These are the agreed requirements. Research informs HOW, not WHAT.

### Functional Decisions

| Decision                      | Details                                                                                                                  | Rationale                                                  | Verify                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| Business hours constraint     | Tasks can only be scheduled between 9:00-18:00 (9 hours total)                                                           | Romanian standard business hours                           | Create task → appears within 9:00-18:00 range                              |
| Auto-schedule on creation     | When task is created with due date, automatically assign `scheduledStartTime` to first available slot starting from 9:00 | Reduces manual work, ensures tasks are visible in calendar | Create task with due date → task appears at first free slot on that day    |
| Events have absolute priority | Calendar events (court dates, hearings, meetings) are immutable; tasks must work around them                             | Events are external commitments that can't be moved        | Create event overlapping task → task moves, event stays                    |
| Overflow to previous day      | If a day's tasks + events exceed 9 hours, the longest task (by remaining duration) extends into the previous day         | Ensures all work is visible, prevents hidden overflow      | Schedule 10h of tasks on Monday → longest task shows partly on Sunday      |
| Cascade overflow              | If previous day is also full, continue cascading backwards until space is found                                          | Handles fully-booked weeks                                 | Week fully booked → tasks cascade to previous week                         |
| Remaining duration for sizing | Task duration = `estimatedHours - loggedTime` (minimum 0.5h)                                                             | Reflects actual remaining work, not original estimate      | Log 2h on 4h task → task shrinks to 2h in calendar                         |
| Manual drag: single task only | When user drags a task, only that task moves - no other tasks shift or change position                                   | Predictable, non-surprising behavior                       | Drag task A → task B stays exactly where it was                            |
| Conflict resolution on drag   | If dropped on occupied slot → animate task to nearest available slot on same day                                         | Helpful UX, finds valid position automatically             | Drop task on occupied 10:00 → animates to 11:30 (next free slot)           |
| No space: snap back           | If no available slot on target day → animate back to original position + show toast explaining why                       | Prevents accidental day changes, user stays in control     | Drop task on fully-booked day → snaps back with "Nu există loc disponibil" |
| Role-based drag permissions   | Partners & Associates: drag any direction; Jr Associates: only backward (earlier time AND earlier date)                  | Jr Associates shouldn't push deadlines forward             | Jr Associate drags task to later date → prevented with message             |
| System change notifications   | When system moves tasks (overflow, event conflicts), show toast notification explaining what happened                    | User understands why things moved                          | Event created → toast "Sarcina X a fost mutată din cauza evenimentului Y"  |
| Animated transitions          | All task movements (manual drag, auto-scheduling, overflow) must animate so user can follow visually                     | Prevents confusion, shows cause-and-effect                 | Task overflows → visible animation from day A to day B                     |

### Technical Decisions

| Decision                    | Details                                                                  | Rationale                                                          | Verify                                                            |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Backend scheduling service  | New `TaskSchedulingService` calculates and persists `scheduledStartTime` | Single source of truth, works across web/mobile/API                | Query task → has valid `scheduledStartTime` within business hours |
| Slot calculation endpoint   | New query `getAvailableSlots(date, duration)` returns free time ranges   | Frontend needs this for drag-drop validation and visual feedback   | Call with date + 2h → returns list of available 2h slots          |
| Re-schedule on event change | When event is created/modified/deleted, re-calculate affected tasks only | Events have priority, tasks must yield                             | Create event 10:00-12:00 → tasks in that range get new times      |
| Optimistic UI with rollback | Frontend shows animation immediately, rolls back if backend rejects      | Responsive feel while maintaining data integrity                   | Drag task → animates immediately → if error, animates back        |
| Business hours config       | Hardcoded 9:00-18:00 initially, can add firm settings later              | Keep it simple, extend when needed                                 | N/A for now                                                       |
| Animation library           | Use Framer Motion `AnimatePresence` + `layout` prop for task movements   | Already available in project, handles enter/exit/layout animations | Tasks animate smoothly between positions                          |

### Out of Scope

- Configurable business hours per firm (hardcode 9:00-18:00 for now)
- Drag-drop on mobile (existing mobile calendar is read-only)
- Multi-day task spanning (task shows on one day only, overflow creates separate visual block)
- Recurring task scheduling
- Team capacity view (seeing all team members' schedules side-by-side)
- Undo/redo for task movements

---

## Research Findings

### Open Questions - Answered

| Question                                                      | Answer                                                                                                                                                                  | Evidence                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How does DayColumn handle task positioning?                   | Absolute positioning with `top` in pixels. Formula: `hoursFromStart * 48 + (minutes / 60) * 48`. Already has `transition-all duration-150 ease-out`.                    | `DayColumn.tsx:78-82` (calculateEventPosition), `DayColumn.tsx:330-331` (transitions)                                                                                 |
| What's the current drag-drop implementation?                  | Native HTML5 Drag and Drop with 15-minute snapping. `dataTransfer.setData()` for task ID, drop handlers calculate time from Y position.                                 | `TaskCard.tsx:150-170` (dragStart), `DayColumn.tsx:188-235` (drop handlers)                                                                                           |
| How to detect Jr Associate role for drag permission?          | `useAuth()` hook returns `user.role`. Jr Associate = `'SECRETARY'` in frontend mapping. Check: `user?.role !== 'SECRETARY'`.                                            | `useAuth.ts:23-47`, `authStore.ts:8-15`, `schema.prisma:288-293` (UserRole enum)                                                                                      |
| Does CalendarConflictService have slot calculation logic?     | YES - has `getOccupiedSlots()` returning all occupied time ranges, `timeRangesOverlap()` for overlap detection, `addHoursToTime()` utility. 90% of needed logic exists. | `calendar-conflict.service.ts:242-370` (getOccupiedSlots), `calendar-conflict.service.ts:373-396` (overlap), `calendar-conflict.service.ts:399-416` (time arithmetic) |
| Best way to show overflow tasks spanning two days?            | Split Visual approach: render task in BOTH columns with continuation indicator. Pattern exists in `AllDayRow.tsx`. Show badge "continuă mâine" / "din ieri".            | `AllDayRow.tsx:185-240` (multi-day rendering pattern)                                                                                                                 |
| How to batch re-scheduling when event affects multiple tasks? | Use `prisma.$transaction(async (tx) => { ... })` with `Promise.all()` for parallel updates within transaction. Store undo metadata in `typeMetadata`.                   | `deadline-cascade.service.ts:187-200`, `critical-path.service.ts:187-190`, `workload.service.ts:219`                                                                  |

### Existing Code Analysis

| Category        | Files                                                                                                                                                                                                                                                     | Notes                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Reuse as-is** | `calendar-conflict.service.ts:timeRangesOverlap()`, `calendar-conflict.service.ts:addHoursToTime()`, `useCalendarEvents.ts:calculateRemainingDuration()`, `useCalendarEvents.ts:calculateEndTime()`                                                       | These utilities handle time arithmetic correctly, already cap at 18:00 |
| **Modify**      | `calendar-conflict.service.ts` (add `findNextAvailableSlot()`), `task-warning.service.ts:17` (change `DAILY_CAPACITY_HOURS` from 8 to 9), `task.service.ts` (integrate scheduling on create/update), `task.resolvers.ts` (add getAvailableSlots resolver) |
| **Create new**  | `task-scheduling.service.ts` (core scheduling logic), `useAvailableSlots.ts` (frontend hook for slot fetching)                                                                                                                                            |

### Patterns Discovered

**Service Singleton Pattern** (`calendar-conflict.service.ts:56-421`):

```typescript
export class CalendarConflictService {
  async checkEventConflicts(...) { ... }
  private addHoursToTime(...) { ... }
}
export const calendarConflictService = new CalendarConflictService();
```

**Drag-Drop Pattern** (`DayColumn.tsx:188-235`):

- 15-minute snap: `Math.floor(minute / 15) * 15`
- Time from Y: `relativeY / HOUR_HEIGHT * 60`
- Drop indicator: visual line at drag position
- `HOUR_HEIGHT = 48px` constant

**Transaction Pattern** (`deadline-cascade.service.ts:187-200`):

```typescript
await prisma.$transaction(async (tx) => {
  const tasks = await tx.task.findMany({ ... });
  return Promise.all(tasks.map(t => tx.task.update({ ... })));
});
```

**Role Check Pattern** (`useAuth.ts`):

```typescript
const { user } = useAuth();
const canDrag = user?.role !== 'SECRETARY';
```

**Animation Pattern** (`TaskCard.tsx:36`):

```typescript
'transition-all duration-150 ease-out';
// Framer Motion installed but unused - can introduce for complex animations
```

### Constraints Found

- **Capacity constant needs update**: `DAILY_CAPACITY_HOURS = 8` in `task-warning.service.ts:17` - must change to 9
- **No Framer Motion usage yet**: Installed in `pnpm-lock.yaml` but only used in legacy `web-old/`. Will be first production use.
- **Role mapping complexity**: Backend uses `AssociateJr`, frontend uses `SECRETARY` - need clear mapping
- **15-minute grid**: Existing snap interval is hardcoded - works for our purposes

---

## Implementation Recommendation

### Phase 1: Backend Service (TaskSchedulingService)

Create new service extending existing `CalendarConflictService` patterns:

1. **Core method: `findFirstAvailableSlot()`**
   - Get occupied slots via `getOccupiedSlots()`
   - Walk through 9:00-18:00 finding gaps >= task duration
   - If no gap, cascade to previous day
   - Return `{ date, startTime }`

2. **Auto-schedule integration:**
   - Hook into `task.service.ts` create/update
   - When task has `dueDate` but no `scheduledStartTime`, auto-calculate
   - Respect `pinned: true` tasks (don't move them)

3. **Batch re-scheduling:**
   - When event created/modified, find conflicting tasks
   - Use transaction to move all at once
   - Return list of moved tasks for notification

### Phase 2: GraphQL API

1. **New query**: `getAvailableSlots(date, duration, assigneeId)`
   - Returns array of `{ startTime, endTime, available, reason }`
   - Frontend uses for drop zone validation

2. **Enhance mutations:**
   - `createTask`: Auto-schedule if no time provided
   - `rescheduleTask`: Validate role permissions, return warnings

### Phase 3: Frontend Integration

1. **Role-based drag:**
   - Add `canDrag` check in TaskCard
   - Jr Associates (`SECRETARY`): only allow backward drags

2. **Optimistic UI:**
   - Move card immediately on drop
   - If backend rejects, animate back + toast

3. **Slot preview:**
   - Fetch available slots on drag start
   - Show green/red indicators on time grid

4. **Overflow visualization:**
   - Split-card approach for multi-day tasks
   - Badge showing "continuă" / "din ieri"

---

## File Plan

| File                                                         | Action | Purpose                                                                         |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------- |
| `services/gateway/src/services/task-scheduling.service.ts`   | Create | Core scheduling logic: findFirstAvailableSlot, auto-schedule, batch re-schedule |
| `services/gateway/src/services/calendar-conflict.service.ts` | Modify | Add public `findNextAvailableSlot()` method reusing existing logic              |
| `services/gateway/src/services/task-warning.service.ts`      | Modify | Change `DAILY_CAPACITY_HOURS` from 8 to 9                                       |
| `services/gateway/src/services/task.service.ts`              | Modify | Call scheduling service in createTask/updateTask                                |
| `services/gateway/src/graphql/schema/task.graphql`           | Modify | Add `getAvailableSlots` query, `TimeSlot` type                                  |
| `services/gateway/src/graphql/resolvers/task.resolvers.ts`   | Modify | Add `getAvailableSlots` resolver, enhance mutation role checks                  |
| `apps/web/src/graphql/queries.ts`                            | Modify | Add `GET_AVAILABLE_SLOTS` query                                                 |
| `apps/web/src/hooks/useAvailableSlots.ts`                    | Create | Hook for fetching available slots                                               |
| `apps/web/src/components/calendar/DayColumn.tsx`             | Modify | Add slot preview indicators, optimistic drop handling                           |
| `apps/web/src/components/calendar/TaskCard.tsx`              | Modify | Add role-based `draggable` prop, Framer Motion layout animation                 |
| `apps/web/src/app/(dashboard)/calendar/page.tsx`             | Modify | Enhance reschedule handler with optimistic UI, toast notifications              |

---

## Risks

| Risk                                               | Mitigation                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| Cascade overflow could move tasks far back in time | Limit cascade to 7 days max, show warning if can't fit              |
| Framer Motion first use - learning curve           | Start simple with `layout` prop, avoid complex orchestration        |
| Role mapping confusion (AssociateJr vs SECRETARY)  | Add clear comment mapping roles, create `canDragTask(user)` helper  |
| Batch re-scheduling performance with many tasks    | Use transaction + Promise.all, limit to 50 tasks per batch          |
| Optimistic UI race conditions                      | Use task ID + timestamp for conflict detection, queue rapid updates |

---

## Next Step

Start a new session and run:
`/plan research-task-smart-scheduling`
