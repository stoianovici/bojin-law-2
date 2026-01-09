# Brainstorm: Smart Task Scheduling in Calendar

**Status**: Complete
**Date**: 2026-01-06
**Next step**: `/research brainstorm-task-smart-scheduling`

---

## Problem Statement

Tasks in the calendar need intelligent auto-scheduling within business hours (9:00-18:00) that avoids conflicts with events and other tasks. Currently, tasks have `scheduledDate` and `scheduledStartTime` fields but no auto-positioning logic - they must be manually placed. We need automatic slot assignment on creation, smart conflict resolution, and intuitive drag-drop behavior with role-based permissions.

## Decisions

> **IMPORTANT**: This section propagates unchanged through research → plan → implement.
> Be specific and complete. These are the requirements.

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

### Open Questions for Research

- [ ] How does the current `DayColumn` component handle task positioning? What changes needed for animation?
- [ ] What's the current drag-drop implementation? (react-dnd, native, custom?)
- [ ] How to detect Jr Associate role in frontend for drag permission check?
- [ ] Does `CalendarConflictService` already have the slot calculation logic we need?
- [ ] What's the best way to show overflow tasks spanning two days visually?
- [ ] How to batch re-scheduling when an event affects multiple tasks?

---

## Context Snapshot

The calendar system already has:

- `Task` model with `scheduledDate`, `scheduledStartTime`, `pinned`, `estimatedHours` fields
- `CalendarConflictService` for overlap detection
- `TaskWarningService` for capacity warnings (8h daily limit - needs update to 9h)
- `useCalendarEvents` hook transforming tasks for calendar display
- `DayColumn` component with time grid (48px/hour) and absolute positioning
- `TaskCard` component with drag-drop support and variants (on-track, due-today, overdue, locked)
- 15-minute snap intervals for positioning

This builds on that foundation, adding:

- Auto-scheduling logic (new service)
- Smart conflict resolution on drag
- Animated transitions
- Role-based permissions
- Overflow cascade to previous days

## Next Step

Start a new session and run:
`/research brainstorm-task-smart-scheduling`
