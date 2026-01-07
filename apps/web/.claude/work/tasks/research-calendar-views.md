# Research: Calendar Views (Zi/Luna/Agenda)

**Status**: Complete
**Date**: 2026-01-02
**Input**: `brainstorm-calendar-views.md`
**Next step**: `/plan research-calendar-views`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client (GraphQL)
**Desktop Calendar**: `src/app/(dashboard)/calendar/page.tsx` (week view only)
**Mobile Calendar**: `src/app/m/calendar/page.tsx` (month grid already exists)

### Color Scheme

- **court**: Red `#EF4444`
- **hearing**: Pink `#EC4899`
- **deadline**: Amber `#F59E0B`
- **meeting**: Blue `#3B82F6`
- **reminder**: Green `#22C55E`

---

## Problem Statement

The desktop calendar currently only has a week view. Need to implement:

1. **Zi (Day)** - Two-panel single-day view with event details
2. **Luna (Month)** - Monthly overview grid
3. **Agenda** - Chronological list of upcoming events

---

## Research Findings

### Existing Code Analysis

#### Reusable Components

| Component     | Path                                        | Reuse Strategy                             |
| ------------- | ------------------------------------------- | ------------------------------------------ |
| DayColumn     | `src/components/calendar/DayColumn.tsx`     | **Fully reusable** - no week-view coupling |
| TimeGrid      | `src/components/calendar/TimeGrid.tsx`      | **Reusable** - configurable hours          |
| TaskCard      | `src/components/calendar/TaskCard.tsx`      | **Reusable** - drag-drop enabled           |
| CalendarEvent | `src/components/calendar/CalendarEvent.tsx` | **Reusable** - event display               |
| AllDayRow     | `src/components/calendar/AllDayRow.tsx`     | Adapt for single-day variant               |
| ScrollArea    | `src/components/ui/ScrollArea.tsx`          | For scrollable content                     |
| Badge         | `src/components/ui/Badge.tsx`               | Event type badges                          |

#### Modify/Extend

| File                                    | Changes Needed                                |
| --------------------------------------- | --------------------------------------------- |
| `src/store/calendarStore.ts`            | Add `selectedEventId` and `selectEvent()`     |
| `src/app/(dashboard)/calendar/page.tsx` | Add view rendering logic for day/month/agenda |

#### Create New

| File                                            | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `src/components/calendar/DayView.tsx`           | Two-panel day view container         |
| `src/components/calendar/EventDetailsPanel.tsx` | Right-side event details             |
| `src/components/calendar/MonthView.tsx`         | Month grid container                 |
| `src/components/calendar/MonthDayCell.tsx`      | Individual day cell with event pills |
| `src/components/calendar/AgendaView.tsx`        | Grouped list container               |
| `src/components/calendar/AgendaGroup.tsx`       | Date group with header               |
| `src/components/calendar/AgendaItem.tsx`        | Single event/task row                |

---

### Patterns Discovered

#### 1. Split View Pattern (CaseListPanel + CaseDetailPanel)

Location: `src/app/(dashboard)/cases/page.tsx`

```tsx
<div className="flex flex-1 overflow-hidden">
  {/* Left panel - fixed width */}
  <div className="w-[400px] flex-shrink-0 border-r flex flex-col">
    <ScrollArea className="flex-1">...</ScrollArea>
  </div>

  {/* Right panel - fills remaining */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {selectedItem ? <Details /> : <EmptyState />}
  </div>
</div>
```

#### 2. Selection State Pattern (Zustand)

Location: `src/store/casesStore.ts`

```typescript
interface CalendarState {
  selectedEventId: string | null;
  selectEvent: (eventId: string | null) => void;
}
```

#### 3. Month Grid Pattern (Mobile Calendar)

Location: `src/app/m/calendar/page.tsx` (lines 54-103)

```tsx
// 7-column grid
<div className="grid grid-cols-7 gap-[2px]">
  {calendarDays.map((day) => (
    <div className={cn('aspect-square flex flex-col p-1', day.month !== 'current' && 'opacity-40')}>
      {/* day number + event indicators */}
    </div>
  ))}
</div>;

// Date calculation utility
function generateCalendarDays(year: number, month: number) {
  // Returns 42 items (6 weeks × 7 days)
  // Handles prev/next month padding
}
```

#### 4. Grouped List Pattern (Tasks Page)

Location: `src/app/(dashboard)/tasks/page.tsx`

```typescript
function groupTasks(tasks: Task[], groupBy: string): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const key = task.dueDate; // or other grouping key
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  });
  return groups;
}

// Render with collapsible headers
{sortedGroups.map(([groupKey, items]) => (
  <TaskGroup title={groupKey} count={items.length} tasks={items} />
))}
```

#### 5. Event Type Styling Pattern

Location: `src/components/calendar/AllDayRow.tsx`

```typescript
const eventTypeStyles = {
  court: {
    bg: 'bg-[rgba(239,68,68,0.15)] dark:bg-[rgba(239,68,68,0.2)]',
    text: 'text-[#B91C1C] dark:text-[#FCA5A5]',
    border: 'border-l-[#EF4444]',
  },
  hearing: {
    /* pink */
  },
  deadline: {
    /* amber */
  },
  meeting: {
    /* blue */
  },
  reminder: {
    /* green */
  },
};
```

#### 6. Empty State Pattern

```tsx
<div className="flex flex-col items-center justify-center py-12">
  <p className="text-sm text-linear-text-tertiary">No events in the next {days} days</p>
</div>
```

---

### Data Fetching Research

#### Current Hook: `useCalendar`

Location: `src/hooks/mobile/useCalendar.ts`

```typescript
const { events, tasks, loading, error, refetch } = useCalendar(startDate, endDate);
// Uses GET_MY_TASKS GraphQL query
// Separates by type: EVENT_TYPES = ['Meeting', 'CourtDate', 'BusinessTrip']
```

#### GraphQL Query Filters

```typescript
interface TaskFilterInput {
  dueDateFrom?: string; // ISO date string
  dueDateTo?: string; // ISO date string
  status?: string;
  type?: string;
}
```

#### Date Range Strategies by View

```typescript
// Day view - single day
const dayStr = currentDate.toISOString().split('T')[0];
useCalendar(dayStr, dayStr);

// Month view - full month
const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
useCalendar(monthStart, monthEnd);

// Agenda view - configurable range
const agendaEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
useCalendar(today, agendaEnd.toISOString().split('T')[0]);
```

#### Available Date Utilities

- `formatDateKey(date)` → `"YYYY-MM-DD"` (AllDayRow.tsx)
- `getWeekDays(weekStart)` → 5-day array (CalendarWeekHeader.tsx)
- `isSameDay(date1, date2)` → boolean (CalendarWeekHeader.tsx)
- `generateCalendarDays(year, month)` → 42-item grid (mobile calendar)

#### date-fns Available

```typescript
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { ro } from 'date-fns/locale';
```

---

### Constraints Found

1. **Store Persistence**: `calendarStore` persists `view`, `selectedCalendars`, `selectedTeamMembers` to localStorage - NOT `currentDate`

2. **Event Type Mapping**: Backend `TaskType` enum maps to frontend display types:
   - `Meeting` → `meeting`
   - `CourtDate` → `court`
   - `BusinessTrip` → `meeting`

3. **Time Zone**: Events use local time strings (`HH:MM` format) - no timezone conversion needed

4. **Hour Range**: DayColumn expects `startHour`/`endHour` (default 8-18) - same as TimeGrid

5. **Design Tokens**: Use `linear-*` colors for desktop, `mobile-*` for mobile

---

## Implementation Recommendation

### Day View (Zi)

Use existing `DayColumn` in a two-panel flex layout following `CasesPage` pattern:

```tsx
<div className="flex flex-1 overflow-hidden">
  <div className="flex-1 flex">
    <TimeGrid startHour={8} endHour={18} />
    <DayColumn
      date={currentDate}
      events={events}
      tasks={tasks}
      onEventClick={(id) => selectEvent(id)}
    />
  </div>
  <EventDetailsPanel event={selectedEvent} onClose={() => selectEvent(null)} />
</div>
```

### Month View (Luna)

Port and enhance mobile calendar's month grid to desktop:

```tsx
<div className="grid grid-cols-7 gap-1">
  {/* Weekday headers */}
  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day) => (
    <div className="text-center text-sm py-2">{day}</div>
  ))}

  {/* Day cells */}
  {generateCalendarDays(year, month).map((day) => (
    <MonthDayCell
      day={day}
      events={eventsByDate[day.fullDate]}
      onClick={() => goToDay(day.fullDate)}
    />
  ))}
</div>
```

### Agenda View

Follow tasks page grouping pattern with date-based groups:

```tsx
<ScrollArea className="flex-1">
  {sortedGroups.map(([dateKey, items]) => (
    <AgendaGroup key={dateKey} date={dateKey} items={items} defaultExpanded={isToday(dateKey)} />
  ))}
  {sortedGroups.length === 0 && <EmptyState days={agendaDays} />}
</ScrollArea>
```

---

## File Plan

| File                                            | Action | Purpose                                              |
| ----------------------------------------------- | ------ | ---------------------------------------------------- |
| `src/store/calendarStore.ts`                    | Modify | Add `selectedEventId`, `selectEvent()`, `agendaDays` |
| `src/components/calendar/DayView.tsx`           | Create | Two-panel container for day view                     |
| `src/components/calendar/EventDetailsPanel.tsx` | Create | Right panel showing event details                    |
| `src/components/calendar/MonthView.tsx`         | Create | Month grid container with navigation                 |
| `src/components/calendar/MonthDayCell.tsx`      | Create | Day cell with event pills                            |
| `src/components/calendar/AgendaView.tsx`        | Create | Agenda list container                                |
| `src/components/calendar/AgendaGroup.tsx`       | Create | Collapsible date group                               |
| `src/components/calendar/AgendaItem.tsx`        | Create | Event row in agenda                                  |
| `src/app/(dashboard)/calendar/page.tsx`         | Modify | Render correct view based on store.view              |

---

## Risks

1. **Month View Performance**: Fetching all month events at once could be slow
   - Mitigation: Use loading states, consider pagination for dense months

2. **Event Overlap in Month Cells**: Multiple events per day
   - Mitigation: Show max 2-3 pills + "+N more" indicator

3. **Agenda Scroll Performance**: Many events over 30 days
   - Mitigation: Consider virtualization if > 100 items

4. **Detail Panel Width**: Too much empty space for short events
   - Mitigation: Responsive width or collapsible panel

---

## Next Step

Start a new session and run:

```
/plan research-calendar-views
```
