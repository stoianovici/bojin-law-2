# Plan: Tasks & Calendar v2 Implementation

**Status**: Approved
**Date**: 2025-12-29
**Input**: `docs/design/tasks-v2.html`, `docs/design/calendar-v2.html`
**Next step**: `/implement plan-tasks-calendar-v2`

---

## Context Summary

- **Project**: `/Users/mio/Developer/bojin-law-ui` - Next.js 14 App Router
- **Tech Stack**: React, TypeScript, Tailwind CSS, GraphQL, Zustand
- **Design System**: Linear-style with CSS variables (`--linear-*`)
- **Components**: `src/components/ui/` (primitives), `src/components/layout/` (shell)
- **Pages**: `src/app/(dashboard)/` with shared layout (Sidebar + Header + main)

## Approach Summary

Implement v2 designs for Tasks and Calendar pages. Tasks page adds a fixed 380px right panel showing team activity (default) or task drawer (when task selected). Calendar page is a new implementation with 5-day week view (Mon-Fri), sidebar filters, time grid for events, and draggable task cards at the bottom of each day column.

---

## Parallel Group 1: Shared Components

> These tasks run simultaneously via sub-agents

### Task 1.1: Create TeamActivityFeed Component

- **File**: `src/components/tasks/TeamActivityFeed.tsx` (CREATE)
- **Do**: Create reusable activity feed component showing team member actions
  - Props: `activities: Activity[]`, `onTaskClick?: (taskId: string) => void`
  - Activity types: subtask_completed, status_changed, task_created, comment_added, task_assigned
  - Each item: avatar (initials with gradient), author name, action text, timestamp, optional task link, optional comment/change display
  - Use existing Avatar component pattern, match Linear styling from mockup
- **Done when**: Component renders activity feed matching `tasks-v2.html` mockup styling

### Task 1.2: Create TaskDrawer Component

- **File**: `src/components/tasks/TaskDrawer.tsx` (CREATE)
- **Do**: Create task detail drawer panel component
  - Props: `task: Task | null`, `onClose: () => void`
  - Sections: header (actions + close), title, properties grid (status, priority, assignee, due, duration, case), subtasks list with checkboxes, task-specific activity feed
  - Include add subtask button, action buttons (mark complete, assign, more)
  - Match drawer styling from `tasks-v2.html`
- **Done when**: Component renders full task detail panel matching mockup

### Task 1.3: Create CalendarFilters Component

- **File**: `src/components/calendar/CalendarFilters.tsx` (CREATE)
- **Do**: Create sidebar filter sections for calendar
  - Props: `selectedCalendars`, `selectedTeamMembers`, `onCalendarToggle`, `onTeamToggle`
  - Calendars section: checkboxes with color dots (court-red, hearing-pink, deadline-orange, meeting-blue, task-purple, reminder-green)
  - Team section: checkboxes with avatar initials (5 team members)
  - Filter counts next to each item
- **Done when**: Component renders both filter sections matching `calendar-v2.html` sidebar

### Task 1.4: Create TaskCard Component (for Calendar)

- **File**: `src/components/calendar/TaskCard.tsx` (CREATE)
- **Do**: Create draggable task card for calendar view
  - Props: `task`, `variant: 'on-track' | 'due-today' | 'overdue' | 'locked'`, `onDragStart`, `onDragEnd`
  - Display: title, duration badge, deadline text
  - Visual states: purple border (on-track), orange (due-today), red + tint (overdue), red + lock icon + not draggable (locked)
  - HTML5 drag attributes, cursor states (grab/grabbing/not-allowed)
- **Done when**: Component renders all 4 deadline states, draggable when not locked

### Task 1.5: Create CalendarWeekHeader Component

- **File**: `src/components/calendar/CalendarWeekHeader.tsx` (CREATE)
- **Do**: Create week header showing Mon-Fri with day names and numbers
  - Props: `weekStart: Date`, `today: Date`
  - 5 columns only (no weekends), highlight today with accent circle on number
  - Grid: 60px spacer + 5 equal columns
- **Done when**: Component renders 5-day header row matching `calendar-v2.html`

---

## Parallel Group 2: Calendar Sub-components

> These tasks run simultaneously via sub-agents

### Task 2.1: Create TimeGrid Component

- **File**: `src/components/calendar/TimeGrid.tsx` (CREATE)
- **Do**: Create time grid with hour slots for calendar
  - Props: `startHour: number` (default 8), `endHour: number` (default 18)
  - Time column (60px) with hour labels
  - Hour slots with half-hour divider lines
  - Current time indicator (red line with dot) positioned by current time
- **Done when**: Component renders 8:00-18:00 time grid with current time indicator

### Task 2.2: Create CalendarEvent Component

- **File**: `src/components/calendar/CalendarEvent.tsx` (CREATE)
- **Do**: Create positioned event block for time grid
  - Props: `event`, `top: number`, `height: number`
  - Event types with colors: court (red), hearing (pink), deadline (orange), meeting (blue), reminder (green)
  - Display: title, time, optional location
  - Positioned absolutely within day column
- **Done when**: Component renders color-coded event blocks matching mockup

### Task 2.3: Create AllDayRow Component

- **File**: `src/components/calendar/AllDayRow.tsx` (CREATE)
- **Do**: Create all-day events/tasks row
  - Props: `days: Date[]`, `allDayEvents`, `allDayTasks`
  - "Toata ziua" label in first cell
  - 5 day cells with stacked all-day items
  - All-day tasks are draggable
- **Done when**: Component renders all-day row matching `calendar-v2.html`

### Task 2.4: Create DayColumn Component

- **File**: `src/components/calendar/DayColumn.tsx` (CREATE)
- **Do**: Create single day column with events and tasks area
  - Props: `date`, `events`, `tasks`, `isToday`, `onTaskDrop`
  - Time slots area (relative positioned for events)
  - Tasks area at bottom (drop zone for task cards)
  - Today highlight with subtle accent background
- **Done when**: Component renders day column with events positioned by time and tasks stacked at bottom

### Task 2.5: Create Calendar Store

- **File**: `src/store/calendarStore.ts` (CREATE)
- **Do**: Create Zustand store for calendar state
  - State: `currentDate`, `view: 'day' | 'week' | 'month' | 'agenda'`, `selectedCalendars: string[]`, `selectedTeamMembers: string[]`
  - Actions: `setCurrentDate`, `setView`, `toggleCalendar`, `toggleTeamMember`, `goToToday`, `navigateWeek`
- **Done when**: Store exports typed state and actions for calendar filtering and navigation

---

## Sequential: After Group 2

### Task 3: Create Tasks Store

- **Depends on**: None (can run parallel with Group 2, but listed here for clarity)
- **File**: `src/store/tasksStore.ts` (CREATE)
- **Do**: Create Zustand store for tasks page state
  - State: `rightPanelMode: 'activity' | 'task-detail'`, `selectedTaskId: string | null`
  - Actions: `selectTask(id)`, `closeTaskDrawer()`, `setRightPanelMode`
- **Done when**: Store manages right panel state for tasks page

---

## Parallel Group 3: Page Implementations

> These tasks run simultaneously via sub-agents

### Task 4.1: Implement Tasks Page v2

- **Depends on**: Tasks 1.1, 1.2, 3
- **File**: `src/app/(dashboard)/tasks/page.tsx` (MODIFY)
- **Do**: Rewrite tasks page with new layout
  - Header: title, view toggles (List/Kanban/Calendar), filters bar, "Sarcina noua" button
  - Main area: flex layout with tasks list (flex-1) + right panel (380px fixed)
  - Tasks list: grouped by urgency (Urgente, Aceasta saptamana, Finalizate recent)
  - Task rows: checkbox, priority bar, content (title + meta), duration badge, status, due date, assignee avatar
  - Right panel: TeamActivityFeed (default) or TaskDrawer (when task selected)
  - Wire up tasksStore for panel state
- **Done when**: Page matches `tasks-v2.html` layout with functional task selection and drawer

### Task 4.2: Create Calendar Page

- **Depends on**: Tasks 1.3, 1.4, 1.5, 2.1-2.5
- **File**: `src/app/(dashboard)/calendar/page.tsx` (CREATE)
- **Do**: Create new calendar page
  - Custom layout: override sidebar with CalendarFilters, remove mini-calendar
  - Top bar: title, date range display, view switcher, Today button, nav arrows, "Eveniment Nou" button
  - Week view: CalendarWeekHeader + AllDayRow + week grid (TimeGrid + 5 DayColumns)
  - Wire up calendarStore for filters and navigation
  - Implement drag-and-drop for task cards between days (HTML5 DnD or @dnd-kit)
- **Done when**: Page matches `calendar-v2.html` with working filters, navigation, and task drag-drop

---

## Sequential: Integration

### Task 5: Add Calendar Route and Navigation

- **Depends on**: Task 4.2
- **File**: `src/components/layout/Sidebar.tsx` (MODIFY)
- **Do**:
  - Ensure Calendar nav item links to `/calendar`
  - Add active state for calendar route
- **Done when**: Calendar is accessible from sidebar navigation

### Task 6: Add Mock Data and GraphQL Integration

- **Depends on**: Tasks 4.1, 4.2
- **File**: `src/graphql/queries.ts` (MODIFY) + `src/lib/mockData.ts` (CREATE if needed)
- **Do**:
  - Add `GET_TEAM_ACTIVITY` query for activity feed
  - Add `GET_CALENDAR_EVENTS` query for calendar events
  - Add `estimatedDuration` field to task queries
  - Create mock data matching the mockup scenarios for development
- **Done when**: Both pages can fetch and display data (mock or real)

---

## Final Steps (Sequential)

### Task 7: Integration Testing & Polish

- **Depends on**: All previous tasks
- **Do**:
  - Test task selection → drawer opens with correct data
  - Test drawer close → returns to activity feed
  - Test calendar filters → events/tasks filter correctly
  - Test task drag-drop → task moves between days, locked tasks don't move
  - Test view toggles and navigation
  - Fix any styling inconsistencies with mockups
  - Ensure responsive behavior on smaller screens
- **Done when**: All acceptance criteria pass, UI matches mockups

---

## Session Scope Assessment

- **Total tasks**: 14 (5 + 5 + 1 + 2 + 1 + 1 + 1)
- **Estimated complexity**: Complex
- **Checkpoint recommended at**: After Parallel Group 2 (all components built)

## Acceptance Criteria (Summary)

### Tasks Page

- [ ] Right panel (380px) shows team activity by default
- [ ] Clicking task opens drawer with details, subtasks, activity
- [ ] Close button returns to team activity
- [ ] Duration estimate visible on task rows
- [ ] Tasks grouped by urgency sections

### Calendar Page

- [ ] Mon-Fri only (no weekends)
- [ ] No mini-calendar in sidebar
- [ ] Calendars filter with colored checkboxes
- [ ] Team filter with avatar checkboxes
- [ ] Events positioned by scheduled time
- [ ] Tasks stacked at bottom of each day
- [ ] Tasks draggable between days
- [ ] Locked state (>3 days overdue) blocks dragging
- [ ] Visual deadline state indicators

---

## Next Step

After approval, start a new session and run:

```
/implement plan-tasks-calendar-v2
```
