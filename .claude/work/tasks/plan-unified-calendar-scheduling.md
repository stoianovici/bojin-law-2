# Plan: Unified Calendar with Auto-Scheduling

**Status**: Approved
**Date**: 2026-01-05
**Input**: `research-unified-calendar-scheduling.md`
**Next step**: `/implement plan-unified-calendar-scheduling`

---

## Problem Statement

The calendar currently displays tasks and events in separate visual areas - events in the time grid, tasks in a bottom panel. We need to unify them into a single business hours view where tasks are auto-scheduled around fixed events, with overflow cascading to previous days when a day is overbooked.

## Decisions (from brainstorm)

> **DO NOT MODIFY** - Copy this section verbatim from research doc.
> Every task below must implement these decisions.

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

## Implementation Approach

The implementation follows a bottom-up approach: first extend the database schema with scheduling fields, then build the server-side auto-scheduler service that handles slot allocation and backward overflow, wire it into GraphQL mutations, and finally update the frontend to render tasks in the time grid using the persisted schedule data. The scheduler runs on every task mutation to maintain consistency across the firm.

---

## Tasks

### Parallel Group 1: Schema Foundation

> These tasks run simultaneously via sub-agents

#### Task 1.1: New Task fields

- **Decision**: New Task fields | Add `scheduledDate: Date?` and `scheduledStartTime: String?` (HH:MM) to Task model | Persist calculated positions for firm-wide visibility | Query task → returns scheduledDate and scheduledStartTime
- **File**: `packages/database/prisma/schema.prisma` (MODIFY)
- **Do**: Add to Task model:
  - `scheduledDate DateTime?` - the calculated/pinned date for this task
  - `scheduledStartTime String?` - HH:MM format start time
  - `pinned Boolean @default(false)` - true if user manually positioned
  - `version Int @default(1)` - optimistic locking for concurrent edits
  - Add composite index: `@@index([firmId, scheduledDate, status])` for efficient calendar queries
- **Done when**: Query task → returns scheduledDate and scheduledStartTime

#### Task 1.2: GraphQL schema fields

- **Decision**: New Task fields | Add `scheduledDate: Date?` and `scheduledStartTime: String?` (HH:MM) to Task model | Persist calculated positions for firm-wide visibility | Query task → returns scheduledDate and scheduledStartTime
- **File**: `services/gateway/src/graphql/schema/task.graphql` (MODIFY)
- **Do**: Add to Task type:
  - `scheduledDate: DateTime`
  - `scheduledStartTime: String`
  - `pinned: Boolean`
  - `loggedTime: Float` (computed field for remaining duration calc)
  - Add to TaskInput: `scheduledDate`, `scheduledStartTime`, `pinned`
  - Add mutation: `rescheduleTask(id: ID!, scheduledDate: DateTime!, scheduledStartTime: String!): Task`
- **Done when**: GraphQL schema includes new fields and reschedule mutation

---

### Sequential: After Group 1

#### Task 2: Database migration

- **Decision**: New Task fields (continuation)
- **Depends on**: Task 1.1
- **File**: Database migration
- **Do**:
  - Run `pnpm --filter database exec prisma db push` for seed database
  - Run migration for real database: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legal_platform pnpm --filter database exec prisma db push`
  - Set initial values: `scheduledDate = dueDate` for non-completed tasks (migration script)
- **Done when**: Both databases have new columns, existing tasks have scheduledDate populated

---

### Parallel Group 2: Backend Services

> These tasks run simultaneously via sub-agents

#### Task 3.1: Server-side scheduler

- **Decision**: Server-side scheduler | Auto-scheduling algorithm runs on gateway, not client | Consistent results, handles concurrent edits | Two users add tasks simultaneously → both see consistent schedule
- **File**: `services/gateway/src/services/task-scheduler.service.ts` (CREATE)
- **Do**: Create TaskSchedulerService with:
  - `scheduleTask(taskId, firmId, assigneeId)` - main entry point
  - `calculateRemainingDuration(task)` - estimatedDuration minus logged time
  - `getAvailableSlots(date, assigneeId)` - find free slots around events/pinned tasks
  - `scheduleWithOverflow(task, date, remainingHours, maxRecursion=14)` - recursive backward cascade
  - Business hours: 08:00-18:00 (10 hours visible, 8 hours capacity)
  - Skip pinned tasks in scheduling
  - Return `{ scheduledDate, scheduledStartTime }`
- **Done when**: Two users add tasks simultaneously → both see consistent schedule

#### Task 3.2: Conflict detection service

- **Decision**: Pinned positions | Dragged tasks save their position, scheduler works around them | Manual override when auto-schedule isn't ideal | Drag task to 14:00 → stays at 14:00 after new tasks added
- **File**: `services/gateway/src/services/calendar-conflict.service.ts` (CREATE)
- **Do**: Create CalendarConflictService with:
  - `checkEventConflicts(date, startTime, endTime, assigneeId)` - returns conflicting pinned tasks
  - `validateTaskPlacement(taskId, date, startTime)` - check if slot is available
  - `getOccupiedSlots(date, assigneeId)` - return all blocked time ranges
- **Done when**: Creating event in occupied slot returns warning with conflicting task details

---

### Sequential: After Group 2

#### Task 4: Wire scheduler in task service

- **Decision**: Trigger on task change | Auto-scheduler runs on task create/update/complete/delete | Always current, no manual refresh needed | Create task → calendar updates immediately with new positions
- **Depends on**: Task 3.1
- **File**: `services/gateway/src/services/task.service.ts` (MODIFY)
- **Do**:
  - Import TaskSchedulerService
  - After `createTask`: call `schedulerService.scheduleTask(newTask.id, ...)`
  - After `updateTask`: if dueDate/estimatedDuration changed, call scheduler
  - After task completion: reschedule remaining tasks for that assignee/date
  - Handle optimistic locking with version field
- **Done when**: Create task → calendar updates immediately with new positions

#### Task 5: Task resolvers integration

- **Decision**: Trigger on task change + Drag validation
- **Depends on**: Task 4, Task 1.2
- **File**: `services/gateway/src/graphql/resolvers/task.resolvers.ts` (MODIFY)
- **Do**:
  - Add `loggedTime` field resolver: `SUM(timeEntries.hours)`
  - Add `rescheduleTask` mutation resolver:
    - Validate: new date <= dueDate (drag backward only)
    - Set `pinned = true` when manually positioned
    - Update scheduledDate and scheduledStartTime
    - Increment version for optimistic locking
  - Ensure create/update mutations trigger scheduler
- **Done when**: Drag to invalid slot → server rejects if bypassed

---

### Parallel Group 3: Frontend Data Layer

> These tasks run simultaneously via sub-agents

#### Task 6.1: Update task queries

- **Decision**: Firm-wide visibility | Scheduled positions are persisted and visible to all team members | Partners need to see associate workload | User A schedules task → User B sees same position
- **File**: `apps/web/src/graphql/queries.ts` (MODIFY)
- **Do**: Add to task query fragments:
  - `scheduledDate`
  - `scheduledStartTime`
  - `pinned`
  - `loggedTime`
- **Done when**: User A schedules task → User B sees same position (data available)

#### Task 6.2: Update task mutations

- **Decision**: Drag validation (frontend part)
- **File**: `apps/web/src/graphql/mutations.ts` (MODIFY)
- **Do**:
  - Add `RESCHEDULE_TASK` mutation
  - Update task input types to include scheduling fields
- **Done when**: Frontend can call rescheduleTask mutation

#### Task 6.3: Calendar store toggle

- **Decision**: (From research - completed tasks handling)
- **File**: `apps/web/src/store/calendarStore.ts` (MODIFY)
- **Do**:
  - Add `showCompletedTasks: boolean` (default: true)
  - Add `setShowCompletedTasks(value: boolean)` action
  - Persist to localStorage
- **Done when**: Toggle exists in store, persists across sessions

---

### Sequential: After Group 3

#### Task 7: Transform scheduled tasks

- **Decision**: Remaining time display | Task block height = estimatedDuration - loggedTime | Shows actual remaining work | 4h task with 1h logged → displays as 3h block
- **Depends on**: Task 6.1
- **File**: `apps/web/src/hooks/useCalendarEvents.ts` (MODIFY)
- **Do**:
  - Use `scheduledDate` and `scheduledStartTime` for task positioning (not dueDate)
  - Calculate `remainingDuration = estimatedDuration - loggedTime`
  - Calculate `endTime` from `scheduledStartTime + remainingDuration`
  - Include `pinned` flag in transformed task data
  - Filter completed tasks based on `showCompletedTasks` setting
- **Done when**: 4h task with 1h logged → displays as 3h block (data ready)

#### Task 8: TaskCard time-grid rendering

- **Decision**: Remaining time display + Visual distinction
- **Depends on**: Task 7
- **File**: `apps/web/src/components/calendar/TaskCard.tsx` (MODIFY)
- **Do**:
  - Add optional `height` prop for absolute positioning in time grid
  - Add optional `top` prop for vertical position
  - Show remaining time (not total estimated) in card
  - Add pin icon indicator when `pinned = true`
  - Keep existing variant styling (on-track/due-today/overdue/locked)
- **Done when**: View calendar → tasks and events visually distinct with correct sizing

#### Task 9: Tasks in time grid with drag validation

- **Decision**: Tasks in time grid | Tasks render as blocks in the 08:00-18:00 grid, same as events | Unified view shows true workload | Open calendar → tasks appear in time slots, not in bottom panel
- **Decision**: Drag backward only | Tasks can be dragged to same day or earlier, never past due date | Preserves deadline integrity | Drag task past due date → snaps back / rejected
- **Depends on**: Task 8
- **File**: `apps/web/src/components/calendar/DayColumn.tsx` (MODIFY)
- **Do**:
  - Remove separate tasks-area container (lines 264-296)
  - Render tasks in time grid using absolute positioning (same as events)
  - Use `calculateEventPosition(scheduledStartTime)` for top position
  - Use `calculateEventHeight(scheduledStartTime, endTime)` for height
  - On drag: validate target date <= task.dueDate
  - On invalid drop: show visual rejection (red highlight, snap back)
  - Call `rescheduleTask` mutation on valid drop
- **Done when**: Open calendar → tasks appear in time slots, not in bottom panel; Drag task past due date → snaps back / rejected

#### Task 10: Calendar page integration

- **Decision**: Fill from top + Avoid event slots + Backward overflow (UI integration)
- **Depends on**: Task 9
- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Do**:
  - Pass scheduled task data to DayColumn components
  - Handle reschedule mutation callback from DayColumn
  - Add "Show completed tasks" toggle in filters
  - Ensure tasks and events render together in unified view
- **Done when**: Create 3 tasks → they stack from morning downward; Create event 10:00-11:00, add task → task schedules around it

---

### Final: Integration & Verification

#### Task 11: Wire Together & Test

- **Do**: Connect all pieces, verify all Decisions are implemented
- **Verification checklist**:
  - [ ] Open calendar → tasks appear in time slots, not in bottom panel
  - [ ] Create 3 tasks → they stack from morning downward
  - [ ] Create event 10:00-11:00, add task → task schedules around it
  - [ ] Add 10h of tasks to one day → 2h overflow to previous day
  - [ ] Friday has 10h work → 2h auto-scheduled to Thursday
  - [ ] 4h task with 1h logged → displays as 3h block
  - [ ] Drag task past due date → snaps back / rejected
  - [ ] Drag task to 14:00 → stays at 14:00 after new tasks added
  - [ ] User A schedules task → User B sees same position
  - [ ] Create task → calendar updates immediately with new positions
  - [ ] Query task → returns scheduledDate and scheduledStartTime
  - [ ] Two users add tasks simultaneously → both see consistent schedule
  - [ ] View calendar → tasks and events visually distinct
- **Done when**: Feature works end-to-end per Decisions

---

## Decision Coverage Check

| Decision                | Implemented by Task(s)       |
| ----------------------- | ---------------------------- |
| Tasks in time grid      | Task 9                       |
| Fill from top           | Task 3.1                     |
| Avoid event slots       | Task 3.1                     |
| 8h daily capacity       | Task 3.1                     |
| Backward overflow       | Task 3.1                     |
| Cascade recursively     | Task 3.1                     |
| Remaining time display  | Task 7, Task 8               |
| Drag backward only      | Task 9                       |
| Pinned positions        | Task 3.1, Task 3.2, Task 5   |
| Firm-wide visibility    | Task 1.1, Task 1.2, Task 6.1 |
| Trigger on task change  | Task 4, Task 5               |
| New Task fields         | Task 1.1, Task 1.2, Task 2   |
| Server-side scheduler   | Task 3.1                     |
| Remaining duration calc | Task 3.1, Task 5, Task 7     |
| Visual distinction      | Task 8 (existing styles)     |
| Drag validation         | Task 5, Task 9               |

## Session Scope

- **Total tasks**: 11 (14 sub-tasks in parallel groups)
- **Parallel groups**: 4
- **Complexity**: Complex

---

## Next Step

Start a new session and run:
`/implement plan-unified-calendar-scheduling`
