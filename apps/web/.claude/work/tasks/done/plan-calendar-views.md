# Plan: Calendar Views (Zi/Luna/Agenda)

**Status**: Approved
**Date**: 2026-01-02
**Input**: `research-calendar-views.md`
**Next step**: `/implement plan-calendar-views`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client

**Key Files**:

- Store: `src/store/calendarStore.ts`
- Calendar page: `src/app/(dashboard)/calendar/page.tsx`
- Components: `src/components/calendar/`

**Design Tokens**:

- Colors: court=#EF4444, hearing=#EC4899, deadline=#F59E0B, meeting=#3B82F6, reminder=#22C55E
- Backgrounds: `linear-bg-primary`, `linear-bg-secondary`, `linear-bg-tertiary`, `linear-bg-elevated`
- Text: `linear-text-primary`, `linear-text-secondary`, `linear-text-tertiary`

## Approach Summary

Implement three new calendar views by reusing existing components (`DayColumn`, `TimeGrid`, `TaskCard`) and following established patterns (split-view from Cases page, grouped list from Tasks page, month grid from mobile calendar). The Day view uses a two-panel layout with event details. Month view adapts the mobile calendar grid for desktop. Agenda view groups events chronologically with collapsible date sections.

---

## Parallel Group 1: Store & Foundation Components

> These 4 tasks run simultaneously via sub-agents. No file overlap.

### Task 1.1: Extend Calendar Store

- **File**: `src/store/calendarStore.ts` (MODIFY)
- **Do**:
  1. Add to `CalendarState` interface:
     ```typescript
     selectedEventId: string | null
     agendaDays: number  // default 30
     selectEvent: (eventId: string | null) => void
     setAgendaDays: (days: number) => void
     ```
  2. Add initial values: `selectedEventId: null`, `agendaDays: 30`
  3. Implement actions:
     ```typescript
     selectEvent: (eventId) => set({ selectedEventId: eventId });
     setAgendaDays: (days) => set({ agendaDays: days });
     ```
  4. Add `agendaDays` to `partialize` for localStorage persistence
- **Done when**: Store exports new state and actions, TypeScript compiles

---

### Task 1.2: Create EventDetailsPanel

- **File**: `src/components/calendar/EventDetailsPanel.tsx` (CREATE)
- **Do**:
  1. Create component with props:
     ```typescript
     interface EventDetailsPanelProps {
       event: CalendarEvent | null;
       onClose: () => void;
     }
     ```
  2. Layout: Fixed width panel (w-[400px]), border-l, bg-linear-bg-secondary
  3. Show empty state when `event === null`: "Selectați un eveniment"
  4. When event selected, display:
     - Header with title + close button (X icon)
     - Type badge with color coding (use `eventTypeStyles` pattern from AllDayRow)
     - Time: startTime - endTime
     - Location (if present)
     - Description placeholder
  5. Use existing components: Badge, ScrollArea
  6. Add Romanian labels: "Ora", "Locație", "Detalii"
- **Done when**: Component renders event details or empty state, matches Linear design

---

### Task 1.3: Create MonthDayCell

- **File**: `src/components/calendar/MonthDayCell.tsx` (CREATE)
- **Do**:
  1. Create component with props:
     ```typescript
     interface MonthDayCellProps {
       date: Date;
       isCurrentMonth: boolean;
       isToday: boolean;
       events: Array<{ id: string; title: string; type: string }>;
       tasks: Array<{ id: string; title: string }>;
       onClick: () => void;
     }
     ```
  2. Layout: aspect-square, p-2, hover:bg-linear-bg-hover, cursor-pointer
  3. Day number in top-left, bold if isToday, dimmed if !isCurrentMonth
  4. Event pills below day number:
     - Max 3 visible, each as small colored dot/pill with truncated title
     - Use event type colors from eventTypeStyles
     - If more than 3: show "+N more" text
  5. Handle click to navigate to day view
- **Done when**: Cell displays day number, colored event indicators, overflow count

---

### Task 1.4: Create AgendaItem

- **File**: `src/components/calendar/AgendaItem.tsx` (CREATE)
- **Do**:
  1. Create component with props:
     ```typescript
     interface AgendaItemProps {
       id: string;
       title: string;
       type: 'event' | 'task';
       eventType?: string; // court, hearing, deadline, meeting, reminder
       startTime?: string;
       endTime?: string;
       location?: string;
       onClick: () => void;
     }
     ```
  2. Layout: flex row, py-3, px-4, hover:bg-linear-bg-hover, border-b border-linear-border-subtle
  3. Left: Color indicator bar (4px wide, event type color)
  4. Middle: Title (text-sm font-medium), time below (text-xs text-linear-text-secondary)
  5. Right: Location if present (text-xs text-linear-text-tertiary)
  6. Click triggers onClick handler
- **Done when**: Item displays event/task info with type-colored indicator

---

## Parallel Group 2: View Containers

> These 3 tasks run simultaneously. Depend on Group 1 completion.

### Task 2.1: Create DayView

- **File**: `src/components/calendar/DayView.tsx` (CREATE)
- **Do**:
  1. Create component that uses:
     - `useCalendarStore` for `currentDate`, `selectedEventId`, `selectEvent`
     - Existing `TimeGrid` and `DayColumn` components
  2. Layout (follow CasesPage split-view pattern):
     ```tsx
     <div className="flex flex-1 overflow-hidden">
       {/* Left: Day schedule */}
       <div className="flex-1 flex overflow-hidden">
         <TimeGrid startHour={8} endHour={18} showCurrentTime />
         <div className="flex-1 overflow-y-auto">
           <DayColumn
             date={currentDate}
             events={events}
             tasks={tasks}
             isToday={isToday}
             onEventClick={(id) => selectEvent(id)}
             // ... other handlers
           />
         </div>
       </div>
       {/* Right: Event details */}
       <EventDetailsPanel event={selectedEvent} onClose={() => selectEvent(null)} />
     </div>
     ```
  3. Props: events, tasks, allDayEvents, allDayTasks, handlers (same as week view)
  4. Include AllDayRow for single day
- **Done when**: Day view shows single day with time grid and detail panel

---

### Task 2.2: Create MonthView

- **File**: `src/components/calendar/MonthView.tsx` (CREATE)
- **Do**:
  1. Create component using `useCalendarStore` for `currentDate`, `setCurrentDate`, `setView`
  2. Port `generateCalendarDays(year, month)` from mobile calendar (returns 42 items)
  3. Layout:
     ```tsx
     <div className="flex-1 flex flex-col overflow-hidden p-4">
       {/* Weekday headers */}
       <div className="grid grid-cols-7 gap-1 mb-2">
         {['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'].map((day) => (
           <div className="text-center text-xs text-linear-text-secondary py-2">{day}</div>
         ))}
       </div>
       {/* Day grid */}
       <div className="grid grid-cols-7 gap-1 flex-1">
         {calendarDays.map((day) => (
           <MonthDayCell
             key={day.fullDate}
             date={day.date}
             isCurrentMonth={day.month === 'current'}
             isToday={isSameDay(day.date, today)}
             events={eventsByDate[day.fullDate] || []}
             tasks={tasksByDate[day.fullDate] || []}
             onClick={() => handleDayClick(day.date)}
           />
         ))}
       </div>
     </div>
     ```
  4. handleDayClick: `setCurrentDate(date)` then `setView('day')`
  5. Props: events (Record<string, Event[]>), tasks (Record<string, Task[]>)
- **Done when**: Month grid displays with clickable day cells showing event indicators

---

### Task 2.3: Create AgendaGroup

- **File**: `src/components/calendar/AgendaGroup.tsx` (CREATE)
- **Do**:
  1. Create collapsible group component:
     ```typescript
     interface AgendaGroupProps {
       dateKey: string; // YYYY-MM-DD
       items: Array<AgendaItemProps>;
       defaultExpanded?: boolean;
       onItemClick: (id: string) => void;
     }
     ```
  2. Header: Sticky, shows formatted date (e.g., "Luni, 2 Ianuarie 2026"), item count badge
  3. Use Collapsible from radix or custom expand/collapse with ChevronRight icon
  4. Render AgendaItem for each item in group
  5. Today's group should be defaultExpanded=true
  6. Format date in Romanian: use date-fns with `ro` locale
- **Done when**: Group shows collapsible date header with items list

---

## Sequential: After Group 2

### Task 3: Create AgendaView

- **File**: `src/components/calendar/AgendaView.tsx` (CREATE)
- **Depends on**: Task 1.4 (AgendaItem), Task 2.3 (AgendaGroup)
- **Do**:
  1. Create container component:
     ```typescript
     interface AgendaViewProps {
       events: CalendarEvent[];
       tasks: CalendarTask[];
       onEventClick: (id: string) => void;
       onTaskClick: (id: string) => void;
     }
     ```
  2. Use `useCalendarStore` for `agendaDays`
  3. Group items by date using pattern from tasks page:
     ```typescript
     function groupByDate(events: Event[], tasks: Task[]): Map<string, AgendaItem[]> {
       // Combine events and tasks
       // Sort by date, then by time
       // Group by dateKey (YYYY-MM-DD)
     }
     ```
  4. Layout:
     ```tsx
     <ScrollArea className="flex-1">
       {sortedGroups.length === 0 ? (
         <EmptyState message={`Niciun eveniment în următoarele ${agendaDays} zile`} />
       ) : (
         sortedGroups.map(([dateKey, items]) => (
           <AgendaGroup
             key={dateKey}
             dateKey={dateKey}
             items={items}
             defaultExpanded={isToday(dateKey)}
             onItemClick={handleItemClick}
           />
         ))
       )}
     </ScrollArea>
     ```
  5. Add range selector in header area (7/14/30/60 days)
- **Done when**: Agenda displays grouped events with collapsible sections and empty state

---

## Sequential: Final Integration

### Task 4: Update Calendar Page

- **File**: `src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Depends on**: All view components (Tasks 2.1, 2.2, 3)
- **Do**:
  1. Import new view components:
     ```typescript
     import { DayView } from '@/components/calendar/DayView';
     import { MonthView } from '@/components/calendar/MonthView';
     import { AgendaView } from '@/components/calendar/AgendaView';
     ```
  2. Update navigation handlers to use view-appropriate navigation:
     ```typescript
     const handlePrev = useCallback(() => {
       if (view === 'day') navigateDay('prev');
       else if (view === 'week') navigateWeek('prev');
       else if (view === 'month') navigateMonth('prev');
       // agenda doesn't navigate
     }, [view, navigateDay, navigateWeek, navigateMonth]);
     ```
  3. Update date range display in header based on view:
     - day: "2 Ianuarie 2026"
     - week: "30 Dec - 3 Ian 2026" (existing)
     - month: "Ianuarie 2026"
     - agenda: "Următoarele N zile"
  4. Replace the week view content block with conditional rendering:
     ```tsx
     {/* Calendar Content */}
     <div className="flex-1 flex flex-col overflow-hidden min-w-0">
       {view === 'day' && (
         <DayView
           events={filteredEvents}
           tasks={filteredTasks}
           // handlers...
         />
       )}
       {view === 'week' && (
         // Existing week view code (lines 603-654)
       )}
       {view === 'month' && (
         <MonthView
           eventsByDate={filteredEventsByDate}
           tasksByDate={filteredTasksByDate}
         />
       )}
       {view === 'agenda' && (
         <AgendaView
           events={allFilteredEvents}
           tasks={allFilteredTasks}
           onEventClick={handleEventClick}
           onTaskClick={handleTaskClick}
         />
       )}
     </div>
     ```
  5. Add data preparation for month/agenda views (fetch full month or N days)
- **Done when**: All four views render correctly based on ViewSwitcher selection

---

## Session Scope Assessment

- **Total tasks**: 9
- **Estimated complexity**: Medium
- **Checkpoint recommended at**: After Group 2 (before integration)
- **Parallel capacity**: Group 1 = 4 agents, Group 2 = 3 agents

## Verification Steps

After implementation:

1. `npm run type-check` - TypeScript validation
2. `npm run lint` - ESLint
3. Manual test: Switch between all 4 views
4. Manual test: Click event in Day view shows details panel
5. Manual test: Click day in Month view navigates to Day view
6. Manual test: Agenda groups collapse/expand

---

## Next Step

Start a new session and run:

```
/implement plan-calendar-views
```
