# Brainstorm: Calendar Views (Zi/Luna/Agenda)

**Status**: Complete
**Date**: 2026-01-02
**Next step**: `/research brainstorm-calendar-views`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client (GraphQL)
**Location**: Desktop calendar at `src/app/(dashboard)/calendar/page.tsx`

### Existing Infrastructure

| Component        | Path                                          | Description                      |
| ---------------- | --------------------------------------------- | -------------------------------- |
| Calendar page    | `src/app/(dashboard)/calendar/page.tsx`       | Week view implemented            |
| Calendar store   | `src/store/calendarStore.ts`                  | View state, filters, navigation  |
| DayColumn        | `src/components/calendar/DayColumn.tsx`       | Single day time grid with events |
| CalendarEvent    | `src/components/calendar/CalendarEvent.tsx`   | Event block component            |
| TimeGrid         | `src/components/calendar/TimeGrid.tsx`        | Hour markings                    |
| AllDayRow        | `src/components/calendar/AllDayRow.tsx`       | All-day events area              |
| CalendarFilters  | `src/components/calendar/CalendarFilters.tsx` | Type & team member filters       |
| useCalendar hook | `src/hooks/mobile/useCalendar.ts`             | Fetches tasks as calendar events |

### Data Types

```typescript
// Event types displayed on calendar
type CalendarEventType = 'court' | 'hearing' | 'deadline' | 'meeting' | 'reminder';

// Backend task types that become calendar events
enum TaskType {
  Meeting,
  CourtDate,
  BusinessTrip,
  Research,
  DocumentCreation,
  DocumentRetrieval,
}

// Calendar store view options
type CalendarView = 'day' | 'week' | 'month' | 'agenda';
```

### Color Scheme

- **court**: Red (#EF4444)
- **hearing**: Pink (#EC4899)
- **deadline**: Amber (#F59E0B)
- **meeting**: Blue (#3B82F6)
- **reminder**: Green (#22C55E)

---

## Problem Statement

The desktop calendar currently only has a week view. Need to implement three additional views:

1. **Zi (Day)** - Detailed single-day view
2. **Luna (Month)** - Monthly overview
3. **Agenda** - Chronological list of upcoming events

All views display court dates, task deadlines, and client meetings. Interactions (create, edit, drag-drop) will be implemented separately - this focuses on display/views only.

---

## Decisions

### Day View (Zi)

**Layout**: Two-panel design

- **Left panel**: Enlarged time grid using existing `DayColumn` component
- **Right panel**: Event details panel

**Details panel shows**:

- Event title, time, type badge
- Location (if applicable)
- Linked case info (case number, title)
- Attendees list
- Description/notes

**Actions in panel**:

- Edit button (for future implementation)
- Mark complete button (for tasks/deadlines)
- Placeholder UI for actions, wired up later

**Behavior**:

- Clicking an event in the time grid selects it and shows details
- Empty state when no event selected

---

### Month View (Luna)

**Layout**: Traditional 7-column calendar grid

**Cell content**:

- Day number
- 2-3 event pills with truncated titles
- Color-coded by event type
- "+N more" indicator when overflow

**Navigation**:

- Clicking any day switches to Day view for that date
- Clicking an event pill switches to Day view with that event selected

**Grid behavior**:

- Shows 5-6 week rows depending on month
- Days from adjacent months shown muted
- Today highlighted

---

### Agenda View

**Layout**: Vertical scrolling list

**Structure**:

- Grouped by day with date headers
- Events listed chronologically within each day
- Each event shows: time, title, type badge, location

**Time range**:

- Configurable: 7 / 14 / 30 days
- Default: 14 days
- Dropdown selector in view header

**Empty states**:

- "No events in the next X days" when empty

---

### Shared Patterns

**Filtering**: All views use existing `CalendarFilters` sidebar

- Filter by event type (court, hearing, deadline, meeting, reminder)
- Filter by team member

**View switching**: Existing view switcher in calendar header (day/week/month/agenda tabs)

**Navigation**:

- Day: prev/next day arrows
- Month: prev/next month arrows
- Agenda: time range selector only (no arrows)

**Data fetching**: Extend existing patterns

- Day: fetch single day's events
- Month: fetch full month's events
- Agenda: fetch N days ahead from today

---

## Rationale

| Decision                  | Why                                                      |
| ------------------------- | -------------------------------------------------------- |
| Two-panel day view        | Better use of desktop width, shows context without modal |
| Editable details panel    | Legal workflows need quick task completion               |
| 2-3 events per month cell | Information density without clutter                      |
| Day switch on month click | Simple, consistent navigation model                      |
| Configurable agenda range | Different users have different planning horizons         |
| Shared filter sidebar     | Consistency, less code, familiar UX                      |

---

## Open Questions for Research

- [ ] How does existing `DayColumn` component need to be modified for standalone day view?
- [ ] Best approach for month grid - CSS Grid vs table vs flexbox?
- [ ] Should month view fetch all events upfront or lazy-load on cell hover?
- [ ] How to handle timezone considerations for events?
- [ ] Any existing patterns in codebase for detail panels / split views?
- [ ] Performance considerations for agenda view with many events?

---

## Next Step

Start a new session and run:

```
/research brainstorm-calendar-views
```
