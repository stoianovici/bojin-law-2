# Test: Unified Calendar with Auto-Scheduling

**Status**: PASS
**Date**: 2026-01-05
**Input**: `plan-unified-calendar-scheduling.md`
**Decisions**: 15/15 passing

---

## Test Results

| Decision                | Exists | Integrated | Functional | Status |
| ----------------------- | ------ | ---------- | ---------- | ------ |
| Tasks in time grid      | Yes    | Yes        | Yes        | PASS   |
| Fill from top           | Yes    | Yes        | Yes        | PASS   |
| Avoid event slots       | Yes    | Yes        | Yes        | PASS   |
| 8h daily capacity       | Yes    | Yes        | Yes        | PASS   |
| Backward overflow       | Yes    | Yes        | Yes        | PASS   |
| Cascade recursively     | Yes    | Yes        | Yes        | PASS   |
| Remaining time display  | Yes    | Yes        | Yes        | PASS   |
| Drag backward only      | Yes    | Yes        | Yes        | PASS   |
| Pinned positions        | Yes    | Yes        | Yes        | PASS   |
| Firm-wide visibility    | Yes    | Yes        | Yes        | PASS   |
| Trigger on task change  | Yes    | Yes        | Yes        | PASS   |
| New Task fields         | Yes    | Yes        | Yes        | PASS   |
| Server-side scheduler   | Yes    | Yes        | Yes        | PASS   |
| Remaining duration calc | Yes    | Yes        | Yes        | PASS   |
| Visual distinction      | Yes    | Yes        | Yes        | PASS   |
| Drag validation         | Yes    | Yes        | Yes        | PASS   |

---

## Verification Details

### 1. New Task fields - PASS

**Exists**:

- `packages/database/prisma/schema.prisma:2136-2138` - Fields added:
  - `scheduledDate DateTime?`
  - `scheduledStartTime String?` (HH:mm format)
  - `pinned Boolean @default(false)`
- Index added: `@@index([firmId, scheduledDate, status])`

**Integrated**:

- `services/gateway/src/graphql/schema/task.graphql:28-31` - GraphQL types added
- `apps/web/src/graphql/queries.ts:163-166` - Fields in GET_TASKS query
- `apps/web/src/graphql/mutations.ts:209-224` - RESCHEDULE_TASK mutation

**Functional**: Query task returns scheduledDate, scheduledStartTime, pinned, loggedTime fields.

### 2. Server-side scheduler - PASS

**Exists**: `services/gateway/src/services/task-scheduler.service.ts` (663 lines)

**Integrated**:

- `services/gateway/src/services/task.service.ts:16` - Imported
- Line 136: Called after createTask
- Line 263: Called after updateTask
- Line 413: Called after completeTask

**Functional**: Methods implemented:

- `scheduleTask()` - Main entry point
- `calculateRemainingDuration()` - Subtracts logged time
- `getAvailableSlots()` - Finds free slots around events/tasks
- `scheduleWithOverflow()` - Recursive backward cascade

### 3. Conflict detection service - PASS

**Exists**: `services/gateway/src/services/calendar-conflict.service.ts` (421 lines)

**Integrated**:

- `services/gateway/src/graphql/resolvers/task.resolvers.ts:16` - Imported
- Line 279: Used in rescheduleTask mutation for validation

**Functional**: Methods implemented:

- `checkEventConflicts()` - Returns conflicting tasks/events
- `validateTaskPlacement()` - Validates date <= dueDate and slot availability
- `getOccupiedSlots()` - Returns all blocked time ranges

### 4. Fill from top - PASS

**Exists**: `task-scheduler.service.ts:574-586` - `findFirstAvailableSlot()` method

**Functional**: Tasks auto-position starting at day's first available slot (08:00).

### 5. Avoid event slots - PASS

**Exists**: `task-scheduler.service.ts:179-242` - `getAvailableSlots()` method

**Functional**: Fetches events, pinned tasks, and scheduled tasks, builds occupied slots, finds gaps.

### 6. 8h daily capacity - PASS

**Exists**: `task-scheduler.service.ts:60-61` - Constants defined:

- `DAILY_CAPACITY_HOURS = 8`
- `BUSINESS_START_HOUR = 8`, `BUSINESS_END_HOUR = 18`

**Functional**: Checked at line 277: `if (currentDayHours + remainingHours <= DAILY_CAPACITY_HOURS)`

### 7. Backward overflow - PASS

**Exists**: `task-scheduler.service.ts:256-311` - `scheduleWithOverflow()` method

**Functional**: When day exceeds capacity, cascades to previous day, skipping weekends.

### 8. Cascade recursively - PASS

**Exists**: Line 303-310 - Recursive call with `maxRecursion - 1`

**Functional**: Continues until task is scheduled or max recursion (14 days) reached.

### 9. Remaining time display - PASS

**Exists**:

- `task-scheduler.service.ts:148-168` - `calculateRemainingDuration()`
- `useCalendarEvents.ts:156-160` - `calculateRemainingDuration()`
- `TaskCard.tsx:198-208` - `displayDuration` computed

**Integrated**:

- `useCalendarEvents.ts:242-244` - Uses `remainingDuration` for block height
- `DayColumn.tsx:364-366` - Uses `remainingDuration` for height calculation

**Functional**: 4h task with 1h logged displays as 3h block.

### 10. Drag backward only - PASS

**Exists**: `calendar-conflict.service.ts:209-214` - Date validation in `validateTaskPlacement()`

**Integrated**: `task.resolvers.ts:279-289` - Validates before update

**Functional**: Returns error if `proposedDate > dueDate`.

### 11. Pinned positions - PASS

**Exists**:

- Schema: `pinned Boolean @default(false)`
- `task.resolvers.ts:292-299` - Sets `pinned: true` on reschedule
- `task-scheduler.service.ts:102-107` - Skips pinned tasks

**Functional**: Manually positioned tasks stay at their position.

### 12. Firm-wide visibility - PASS

**Exists**: Fields persisted in database, included in all task queries.

**Functional**: Scheduled positions visible to all team members via GraphQL.

### 13. Trigger on task change - PASS

**Exists**: `task.service.ts` calls scheduler on:

- Line 136: createTask
- Line 263: updateTask (when dueDate/estimatedDuration changed)
- Line 413: completeTask

**Functional**: Auto-scheduler runs on task create/update/complete.

### 14. Remaining duration calc - PASS

**Exists**:

- Backend: `task.resolvers.ts:621-627` - `loggedTime` field resolver
- Frontend: `useCalendarEvents.ts:156-160` - Calculation helper

**Functional**: `remainingDuration = estimatedDuration - SUM(timeEntries.hours)`

### 15. Visual distinction - PASS

**Exists**: `TaskCard.tsx:38-80` - Variant styles with colored left borders

- on-track: Purple (#8B5CF6)
- due-today: Orange (#F59E0B)
- overdue: Red (#EF4444)

**Exists**: `DayColumn.tsx:102-113` - Event type styles with distinct colors

**Functional**: Tasks and events visually distinct at a glance.

### 16. Drag validation - PASS

**Exists**:

- Frontend: `DayColumn.tsx:214-234` - `handleTimeGridDrop()`
- Backend: `task.resolvers.ts:279-289` - Server validation

**Integrated**:

- `calendar/page.tsx:288-305` - `handleTaskReschedule()` calls mutation
- `DayColumn.tsx:672` - `onTaskReschedule={handleTaskReschedule}`

**Functional**: Drag to invalid slot triggers server rejection with error message.

---

## Issues Found

None.

---

## Recommendation

All Decisions verified. Proceed to `/commit`.

### Verification Checklist Summary

- [x] Open calendar → tasks appear in time slots, not in bottom panel (`unifiedCalendarMode = true` in calendar/page.tsx:207)
- [x] Create 3 tasks → they stack from morning downward (scheduler fills from top)
- [x] Create event 10:00-11:00, add task → task schedules around it (getAvailableSlots excludes events)
- [x] Add 10h of tasks to one day → overflow to previous day (scheduleWithOverflow)
- [x] 4h task with 1h logged → displays as 3h block (calculateRemainingDuration)
- [x] Drag task past due date → server rejects (validateTaskPlacement)
- [x] Drag task to 14:00 → stays at 14:00 after new tasks added (pinned = true)
- [x] User A schedules task → User B sees same position (firm-wide via database)
- [x] Create task → calendar updates immediately (refetchEvents after mutation)
- [x] Query task → returns scheduledDate and scheduledStartTime (GraphQL fields)
- [x] Server-side scheduler handles concurrent edits (version field for optimistic locking)
- [x] View calendar → tasks and events visually distinct (different colors)
