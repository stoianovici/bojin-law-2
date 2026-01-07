# Plan: Smart Task Scheduling in Calendar

**Status**: Approved
**Date**: 2026-01-06
**Input**: `research-task-smart-scheduling.md`
**Next step**: `/implement plan-task-smart-scheduling`

---

## Problem Statement

Tasks in the calendar need intelligent auto-scheduling within business hours (9:00-18:00) that avoids conflicts with events and other tasks. Currently, tasks have `scheduledDate` and `scheduledStartTime` fields but no auto-positioning logic - they must be manually placed. We need automatic slot assignment on creation, smart conflict resolution, and intuitive drag-drop behavior with role-based permissions.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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

## Implementation Approach

We implement scheduling in backend-first order. First, create the core `TaskSchedulingService` with slot-finding algorithms that respect business hours, events, and cascade overflow. Then expose via GraphQL API with the `getAvailableSlots` query. Finally, integrate into frontend with role-based drag permissions, optimistic UI, and Framer Motion animations. The key insight from research is that 90% of slot calculation logic already exists in `CalendarConflictService` - we extend it rather than rebuild.

---

## Tasks

### Parallel Group 1: Backend Foundation

> These tasks run simultaneously via sub-agents. Each owns distinct files.

#### Task 1.1: Business hours config update

- **Decision**: Business hours constraint | Tasks can only be scheduled between 9:00-18:00 (9 hours total) | Romanian standard business hours | Create task → appears within 9:00-18:00 range
- **File**: `services/gateway/src/services/task-warning.service.ts` (MODIFY)
- **Do**: Change `DAILY_CAPACITY_HOURS` constant from 8 to 9. Add `BUSINESS_HOURS_START = '09:00'` and `BUSINESS_HOURS_END = '18:00'` constants for reuse.
- **Done when**: Create task → appears within 9:00-18:00 range

#### Task 1.2: Slot calculation in CalendarConflictService

- **Decision**: Slot calculation endpoint | New query `getAvailableSlots(date, duration)` returns free time ranges | Frontend needs this for drag-drop validation and visual feedback | Call with date + 2h → returns list of available 2h slots
- **File**: `services/gateway/src/services/calendar-conflict.service.ts` (MODIFY)
- **Do**: Add public `findAvailableSlots(date, duration, assigneeId): TimeSlot[]` method. Reuse existing `getOccupiedSlots()` and `timeRangesOverlap()`. Return array of `{ startTime, endTime }` gaps that fit the duration within 9:00-18:00.
- **Done when**: Call with date + 2h → returns list of available 2h slots

---

### Sequential: After Group 1

#### Task 2: Core TaskSchedulingService

- **Decision**: Backend scheduling service | New `TaskSchedulingService` calculates and persists `scheduledStartTime` | Single source of truth, works across web/mobile/API | Query task → has valid `scheduledStartTime` within business hours
- **Depends on**: Task 1.1, 1.2
- **File**: `services/gateway/src/services/task-scheduling.service.ts` (CREATE)
- **Do**: Create service with methods:
  - `findFirstAvailableSlot(dueDate, duration, assigneeId)` - uses CalendarConflictService
  - `autoScheduleTask(task)` - assigns scheduledStartTime if missing
  - `calculateRemainingDuration(task)` - implements `estimatedHours - loggedTime` (min 0.5h)
  - Uses business hours constants from task-warning.service
- **Done when**: Query task → has valid `scheduledStartTime` within business hours

---

### Parallel Group 2: Advanced Scheduling Logic

> These tasks run simultaneously via sub-agents

#### Task 3.1: Overflow to previous day logic

- **Decision**: Overflow to previous day | If a day's tasks + events exceed 9 hours, the longest task (by remaining duration) extends into the previous day | Ensures all work is visible, prevents hidden overflow | Schedule 10h of tasks on Monday → longest task shows partly on Sunday
- **Depends on**: Task 2
- **File**: `services/gateway/src/services/task-scheduling.service.ts` (MODIFY)
- **Do**: Add `handleDayOverflow(date, assigneeId)` method. When day exceeds capacity, find longest task by remaining duration, create `OverflowTask` record (or metadata flag) linking to previous day. Implement cascade (max 7 days back per Risks section).
- **Done when**: Schedule 10h of tasks on Monday → longest task shows partly on Sunday

#### Task 3.2: Event priority & re-scheduling

- **Decision**: Re-schedule on event change | When event is created/modified/deleted, re-calculate affected tasks only | Events have priority, tasks must yield | Create event 10:00-12:00 → tasks in that range get new times
- **Depends on**: Task 2
- **File**: `services/gateway/src/services/task-scheduling.service.ts` (MODIFY)
- **File**: `services/gateway/src/graphql/resolvers/event.resolvers.ts` (MODIFY - hook call here)
- **Do**:
  - Add `rescheduleConflictingTasks(event)` method in scheduling service
  - Call this method from event update/create mutations in event resolvers
  - Use transaction to move all conflicting tasks at once
  - Return list of `{ taskId, taskTitle, oldTime, newTime }` for notifications
- **Done when**: Create/edit event 10:00-12:00 → tasks in that range get new times

---

### Sequential: Task Service Integration

#### Task 4: Integrate scheduling into task create/update

- **Decision**: Auto-schedule on creation | When task is created with due date, automatically assign `scheduledStartTime` to first available slot starting from 9:00 | Reduces manual work, ensures tasks are visible in calendar | Create task with due date → task appears at first free slot on that day
- **Depends on**: Task 3.1, 3.2
- **File**: `services/gateway/src/services/task.service.ts` (MODIFY)
- **Do**: In `createTask()` and `updateTask()`, call `taskSchedulingService.autoScheduleTask()` when task has dueDate but no scheduledStartTime. Respect `pinned: true` tasks (don't auto-schedule).
- **Done when**: Create task with due date → task appears at first free slot on that day

---

### Parallel Group 3: GraphQL API Layer

> These tasks run simultaneously via sub-agents

#### Task 5.1: GraphQL schema for slot queries

- **Decision**: Slot calculation endpoint | New query `getAvailableSlots(date, duration)` returns free time ranges | Frontend needs this for drag-drop validation and visual feedback | Call with date + 2h → returns list of available 2h slots
- **File**: `services/gateway/src/graphql/schema/task.graphql` (MODIFY)
- **Do**: Add `TimeSlot` type with `startTime`, `endTime`, `available`, `reason` fields. Add `getAvailableSlots(date: String!, duration: Float!, assigneeId: String): [TimeSlot!]!` query. Add `RescheduleResult` type for mutation responses with `movedTasks` array.
- **Done when**: Schema compiles, types available for resolvers

#### Task 5.2: Frontend query definitions

- **Decision**: Slot calculation endpoint (frontend part)
- **File**: `apps/web/src/graphql/queries.ts` (MODIFY)
- **Do**: Add `GET_AVAILABLE_SLOTS` query matching new schema. Include all TimeSlot fields.
- **Done when**: Query can be imported and used in hooks

---

### Sequential: GraphQL Resolver

#### Task 6: Slot query resolver

- **Decision**: Slot calculation endpoint | New query `getAvailableSlots(date, duration)` returns free time ranges | Frontend needs this for drag-drop validation and visual feedback | Call with date + 2h → returns list of available 2h slots
- **Depends on**: Task 5.1, Task 4
- **File**: `services/gateway/src/graphql/resolvers/task.resolvers.ts` (MODIFY)
- **Do**: Add `getAvailableSlots` resolver calling `taskSchedulingService`. Add role-based permission check in `rescheduleTask` mutation - Jr Associates can only move backward.
- **Done when**: Call with date + 2h → returns list of available 2h slots

---

### Parallel Group 4: Frontend Hooks & State

> These tasks run simultaneously via sub-agents

#### Task 7.1: Available slots hook

- **Decision**: Slot calculation endpoint (frontend consumption)
- **File**: `apps/web/src/hooks/useAvailableSlots.ts` (CREATE)
- **Do**: Create hook using `GET_AVAILABLE_SLOTS` query. Accept `date`, `duration`, `assigneeId` params. Return `{ slots, loading, error, refetch }`. Cache results by date.
- **Done when**: Hook returns slot data when called with valid params

#### Task 7.2: Role-based drag permission helper

- **Decision**: Role-based drag permissions | Partners & Associates: drag any direction; Jr Associates: only backward (earlier time AND earlier date) | Jr Associates shouldn't push deadlines forward | Jr Associate drags task to later date → prevented with message
- **File**: `apps/web/src/hooks/useCalendarEvents.ts` (MODIFY)
- **Do**: Add `canDragTask(user, task)` and `canDropAtTime(user, task, targetDate, targetTime)` helpers. Jr Associates (`SECRETARY` role) can only drag to earlier date/time. Add clear comment mapping `SECRETARY` → Jr Associate.
- **Done when**: Jr Associate drags task to later date → prevented with message

---

### Parallel Group 5: UI Components

> These tasks run simultaneously via sub-agents

#### Task 8.1: TaskCard drag enhancement with animations

- **Decision**: Animated transitions | All task movements (manual drag, auto-scheduling, overflow) must animate so user can follow visually | Prevents confusion, shows cause-and-effect | Task overflows → visible animation from day A to day B
- **File**: `apps/web/src/components/calendar/TaskCard.tsx` (MODIFY)
- **Do**: Add Framer Motion `motion.div` wrapper with `layout` prop. Conditionally set `draggable` based on `canDragTask()` result. Store original position for snap-back animation.
- **Done when**: Tasks animate smoothly between positions

#### Task 8.2: DayColumn slot indicators & drop handling

- **Decision**: Conflict resolution on drag | If dropped on occupied slot → animate task to nearest available slot on same day | Helpful UX, finds valid position automatically | Drop task on occupied 10:00 → animates to 11:30 (next free slot)
- **File**: `apps/web/src/components/calendar/DayColumn.tsx` (MODIFY)
- **Do**: Fetch available slots via `useAvailableSlots` on drag enter. Show green/red overlay on time grid indicating valid/invalid drop zones. Enhance drop handler to find nearest slot if target occupied.
- **Done when**: Drop task on occupied 10:00 → animates to 11:30 (next free slot)

#### Task 8.3: Overflow task spanning visualization

- **Decision**: Overflow to previous day | If a day's tasks + events exceed 9 hours, the longest task (by remaining duration) extends into the previous day | Ensures all work is visible, prevents hidden overflow | Schedule 10h of tasks on Monday → longest task shows partly on Sunday
- **Decision**: Animated transitions | All task movements must animate so user can follow visually
- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx` (MODIFY - week grid container)
- **File**: `apps/web/src/components/calendar/OverflowTaskCard.tsx` (CREATE)
- **Do**:
  - Create `OverflowTaskCard` component that spans 2 grid columns
  - Render overflow tasks at week grid level (outside DayColumn)
  - Use `grid-column: span 2` positioned by start day
  - Framer Motion `animate={{ width }}` for widening animation when overflow happens
  - Badge showing "continuă →" on right edge
- **Done when**: Schedule 10h of tasks on Monday → longest task visually spans to Sunday with widening animation

---

### Sequential: Calendar Page Integration

#### Task 9: Optimistic UI & toast notifications

- **Decision**: Optimistic UI with rollback | Frontend shows animation immediately, rolls back if backend rejects | Responsive feel while maintaining data integrity | Drag task → animates immediately → if error, animates back
- **Decision**: System change notifications | When system moves tasks (overflow, event conflicts), show toast notification explaining what happened | User understands why things moved | Event created → toast "Sarcina X a fost mutată din cauza evenimentului Y"
- **Depends on**: Task 8.1, 8.2, 8.3, Task 7.1, 7.2
- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Do**: Enhance reschedule handler with optimistic cache update. On mutation error, revert position and show toast "Nu s-a putut muta sarcina". On system moves (from mutation response), show toast "Sarcina X a fost mutată din cauza evenimentului Y". Implement snap-back animation on "no space" (toast: "Nu există loc disponibil").
- **Done when**: Drag task → animates immediately → if error, animates back; Event created → toast explains moved tasks

---

### Final: Integration & Verification

#### Task 10: Wire Together & Test

- **Depends on**: All previous tasks
- **Do**:
  - Verify all decisions are implemented end-to-end
  - Test auto-scheduling: create task with due date → appears at first free slot
  - Test event priority: create event → conflicting tasks move
  - Test overflow: book 10h → longest task cascades
  - Test drag permissions: Jr Associate cannot drag forward
  - Test optimistic UI: drag → animate → error → snap back
  - Test notifications: system moves → toast shown
- **Done when**: Feature works end-to-end per all Decisions

---

## Decision Coverage Check

| Decision                      | Implemented by Task(s)                         |
| ----------------------------- | ---------------------------------------------- |
| Business hours constraint     | Task 1.1                                       |
| Auto-schedule on creation     | Task 2, Task 4                                 |
| Events have absolute priority | Task 3.2                                       |
| Overflow to previous day      | Task 3.1, Task 8.3                             |
| Cascade overflow              | Task 3.1                                       |
| Remaining duration for sizing | Task 2                                         |
| Manual drag: single task only | Task 8.1 (default behavior, no shift logic)    |
| Conflict resolution on drag   | Task 8.2                                       |
| No space: snap back           | Task 9                                         |
| Role-based drag permissions   | Task 7.2, Task 6                               |
| System change notifications   | Task 9                                         |
| Animated transitions          | Task 8.1, Task 8.3                             |
| Backend scheduling service    | Task 2                                         |
| Slot calculation endpoint     | Task 1.2, Task 5.1, Task 5.2, Task 6, Task 7.1 |
| Re-schedule on event change   | Task 3.2                                       |
| Optimistic UI with rollback   | Task 9                                         |
| Business hours config         | Task 1.1                                       |
| Animation library             | Task 8.1, Task 8.3                             |

## Session Scope

- **Total tasks**: 11
- **Complexity**: Complex (cross-cutting feature touching backend service, GraphQL, and multiple frontend components)

---

## Next Step

Start a new session and run:
`/implement plan-task-smart-scheduling`
