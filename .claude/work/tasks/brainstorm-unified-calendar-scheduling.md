# Brainstorm: Unified Calendar with Auto-Scheduling

**Status**: Complete
**Date**: 2026-01-05
**Next step**: `/research brainstorm-unified-calendar-scheduling`

---

## Problem Statement

The calendar currently displays tasks and events in separate visual areas - events in the time grid, tasks in a bottom panel. We need to unify them into a single business hours view where tasks are auto-scheduled around fixed events, with overflow cascading to previous days when a day is overbooked.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

### Functional Decisions

| Decision | Details | Rationale | Verify |
|----------|---------|-----------|--------|
| Tasks in time grid | Tasks render as blocks in the 08:00-18:00 grid, same as events | Unified view shows true workload | Open calendar → tasks appear in time slots, not in bottom panel |
| Fill from top | Tasks auto-position starting at day's first available slot (e.g., 09:00) | Natural reading order, fills day progressively | Create 3 tasks → they stack from morning downward |
| Avoid event slots | Auto-scheduler skips time slots occupied by fixed events | Events are immovable commitments | Create event 10:00-11:00, add task → task schedules around it |
| 8h daily capacity | Business day = 8 working hours (configurable later) | Standard workday, prevents overcommitment | Add 10h of tasks to one day → 2h overflow to previous day |
| Backward overflow | When day exceeds capacity, excess tasks cascade to previous day | Deadline integrity - work must happen before due date | Friday has 10h work → 2h auto-scheduled to Thursday |
| Cascade recursively | If previous day also full, continue cascading backward | Handles multi-day overload | Mon-Fri all have 10h → work spreads across week |
| Remaining time display | Task block height = estimatedDuration - loggedTime | Shows actual remaining work | 4h task with 1h logged → displays as 3h block |
| Drag backward only | Tasks can be dragged to same day or earlier, never past due date | Preserves deadline integrity | Drag task past due date → snaps back / rejected |
| Pinned positions | Dragged tasks save their position, scheduler works around them | Manual override when auto-schedule isn't ideal | Drag task to 14:00 → stays at 14:00 after new tasks added |
| Firm-wide visibility | Scheduled positions are persisted and visible to all team members | Partners need to see associate workload | User A schedules task → User B sees same position |
| Trigger on task change | Auto-scheduler runs on task create/update/complete/delete | Always current, no manual refresh needed | Create task → calendar updates immediately with new positions |

### Technical Decisions

| Decision | Details | Rationale | Verify |
|----------|---------|-----------|--------|
| New Task fields | Add `scheduledDate: Date?` and `scheduledStartTime: String?` (HH:MM) to Task model | Persist calculated positions for firm-wide visibility | Query task → returns scheduledDate and scheduledStartTime |
| Server-side scheduler | Auto-scheduling algorithm runs on gateway, not client | Consistent results, handles concurrent edits | Two users add tasks simultaneously → both see consistent schedule |
| Remaining duration calc | `remainingDuration = estimatedDuration - SUM(timeEntries.duration)` | Accurate work remaining | Task with time entries → calendar shows reduced block |
| Visual distinction | Tasks use purple/orange/red left border (existing), events use type-based colors | Easy to distinguish task vs event at a glance | View calendar → tasks and events visually distinct |
| Drag validation | Frontend allows drag to valid slots only; server validates on save | UX + data integrity | Drag to invalid slot → visual rejection + server rejects if bypassed |

### Out of Scope

- Priority-based scheduling (which tasks overflow first) - all tasks equal for now
- Weekend/holiday handling - assume Mon-Fri business days
- Partial-day capacity (e.g., half-day Friday) - full 8h per day
- Multi-assignee tasks - one owner per task
- Time-of-day preferences (e.g., "mornings only") - fills from top uniformly
- Undo/redo for schedule changes

### Open Questions for Research

- [ ] How to handle the initial migration - what `scheduledDate` for existing tasks?
- [ ] Concurrent edit handling - optimistic locking? Last-write-wins?
- [ ] Performance with 100+ tasks per week - batch calculation strategy?
- [ ] How does filtering by team member interact with scheduling?
- [ ] Should completed tasks still show in calendar (greyed out) or disappear?
- [ ] What happens to a pinned task if an event is created in its slot?

---

## Context Snapshot

**Current state:**
- Calendar page at `/calendar` with day/week/month/agenda views
- Events render in time grid (08:00-18:00) with absolute positioning
- Tasks render in a separate bottom panel per day column
- Tasks have `dueDate` and `estimatedDuration` fields
- Time entries exist and track logged time per task
- Drag-and-drop exists but only moves tasks between day panels

**What this builds on:**
- `DayColumn.tsx` - has event positioning logic we can extend for tasks
- `TaskCard.tsx` - existing task rendering component
- `useCalendarEvents.ts` - fetches events and tasks by date range
- `calendarStore.ts` - Zustand store for calendar UI state

**Related files:**
- `apps/web/src/app/(dashboard)/calendar/page.tsx`
- `apps/web/src/components/calendar/DayColumn.tsx`
- `apps/web/src/components/calendar/TaskCard.tsx`
- `services/gateway/src/services/task.service.ts`
- `packages/database/prisma/schema.prisma` (Task model)

## Next Step

Start a new session and run:
`/research brainstorm-unified-calendar-scheduling`
