# Brainstorm: Mobile UI Data Wiring

**Status**: Complete
**Date**: 2024-12-31
**Next step**: `/research brainstorm-mobile-wiring`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Tech Stack**: Next.js 16, TypeScript, Apollo Client 4, Zustand, Tailwind CSS
**Backend**: bojin-law-2 GraphQL gateway at `http://localhost:4000/graphql`

**Current State**:

- 5 mobile pages exist with hardcoded data
- Apollo Client is fully configured with auth headers
- Most GraphQL queries already exist in `src/graphql/queries.ts`
- Need to replace hardcoded data with real backend queries

---

## Problem Statement

The mobile UI displays hardcoded content instead of seeded data from the backend. We need to:

1. Create a reusable data layer with hooks
2. Wire all mobile pages to use real GraphQL queries
3. Implement proper loading (skeletons) and error states (inline)
4. Handle calendar view with events and tasks sections

---

## Decisions

### 1. Approach: Data Layer First (Option B)

Create shared hooks that handle loading, error, and refetch - then update all pages to use them.

### 2. Data Layer Hooks

| Hook                     | Query               | Purpose                          |
| ------------------------ | ------------------- | -------------------------------- |
| `useCases(filters?)`     | `GET_CASES`         | Cases list with optional filters |
| `useCase(id)`            | `GET_CASE`          | Single case detail               |
| `useMyTasks(filters?)`   | `GET_MY_TASKS`      | Current user's tasks             |
| `useTasksByCase(caseId)` | `GET_TASKS_BY_CASE` | Tasks for a specific case        |
| `useSearch(query)`       | `SEARCH_CASES`      | Search results                   |
| `useCalendar(dateRange)` | `myCalendar`        | Events + tasks for calendar      |

Each hook returns: `{ data, loading, error, refetch }`

### 3. Loading States: Skeleton Screens

Match the mockup layouts with skeleton placeholders during loading.

### 4. Error States: Inline Errors

Display error messages inline with retry button capability.

### 5. Calendar Architecture

**Display Structure**:

- Full month calendar at top (collapsible)
- Events section below calendar
- Tasks section below events

**Collapse Behavior**:

- On scroll down: Calendar collapses to show only selected week (sticky)
- On tap collapsed calendar: Expands back to full month view

**Events Section** (fixed-time items):

- Meeting tasks (`type: 'Meeting'`)
- CourtDate tasks (`type: 'CourtDate'`)
- BusinessTrip tasks (`type: 'BusinessTrip'`)

**Tasks Section** (deadline-based items):

- Research tasks
- DocumentCreation tasks
- DocumentRetrieval tasks

### 6. Task Type Definitions

#### Events (Fixed Time)

| Type             | All-Day Logic                 | Metadata Fields                                                                                                               |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Meeting**      | `dueTime` null = all-day      | `meetingType` ('Client'/'Internal'/'External'/'CourtRelated'), `location`, `virtualMeetingUrl`, `agenda`, `minutesDocumentId` |
| **CourtDate**    | `dueTime` null = all-day      | `courtName`, `courtRoom`, `caseNumber`, `hearingType`, `judge`, `preparationNotes`, `preparationSubtaskIds`                   |
| **BusinessTrip** | Multi-day (delegation period) | `destination`, `purpose`, `travelDetails`, `accommodationDetails`, `delegationRequired`, `delegatedTasks`                     |

#### Tasks (Deadline-Based)

| Type                  | Metadata Fields                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Research**          | `researchTopic`, `jurisdiction`, `sources`, `findings`                                                           |
| **DocumentCreation**  | `documentType`, `templateId`, `draftStatus` ('NotStarted'/'InProgress'/'Review'/'Complete'), `outputDocumentId`  |
| **DocumentRetrieval** | `documentDescription`, `sourceLocation`, `retrievalMethod` ('Physical'/'Electronic'/'Request'), `trackingNumber` |

### 7. All-Day vs Timed Event Logic

- **Timed**: `dueDate` + `dueTime` present (e.g., "2024-01-15" + "09:30")
- **All-day**: `dueDate` only, `dueTime` is null
- **Multi-day**: BusinessTrip spans delegation period dates

---

## Mobile Pages to Wire

| Page        | Route           | Data Needed                                   | Query                            |
| ----------- | --------------- | --------------------------------------------- | -------------------------------- |
| Home        | `/m`            | User greeting, attention items, today's tasks | Auth context + `GET_MY_TASKS`    |
| Cases       | `/m/cases`      | Recent cases, all cases with count            | `GET_CASES`                      |
| Case Detail | `/m/cases/[id]` | Case info, open/completed tasks               | `GET_CASE` + `GET_TASKS_BY_CASE` |
| Search      | `/m/search`     | Search results by category                    | `SEARCH_CASES`                   |
| Calendar    | `/m/calendar`   | Month events, tasks by date                   | `myCalendar`                     |

---

## Existing GraphQL Queries (in `src/graphql/queries.ts`)

```typescript
// Cases
GET_CASES; // List with status/assigned filters
GET_CASE; // Single case by ID
SEARCH_CASES; // Search by query string

// Tasks
GET_TASKS; // All tasks with filters
GET_MY_TASKS; // Current user's tasks
GET_TASKS_BY_CASE; // Tasks for specific case

// Calendar (in backend)
myCalendar; // Personal calendar data - MAY NEED TO ADD TO queries.ts
```

---

## Calendar UI Mockup

```
┌─────────────────────────────────┐
│  < December 2024 >              │  ← Tap to navigate months
│  Su Mo Tu We Th Fr Sa           │
│  1  2  3  4  5  6  7            │
│  8  9  10 11 12 13 14           │
│  15 16 17 18 19 20 21           │  ← Dots indicate events/tasks
│  22 23 24 25 26 27 28           │
│  29 30 31                       │
└─────────────────────────────────┘
        ↓ (on scroll, collapses to)
┌─────────────────────────────────┐
│  < Week of Dec 15 >             │  ← Selected week only
│  Su Mo Tu We Th Fr Sa           │
│  15 16 17 18 19 20 21           │  ← Tap to expand
└─────────────────────────────────┘

── Events ──────────────────────────
🟣 09:30  Court hearing - Smith v. Jones
🔵 14:00  Client meeting - Popescu
🔵 All day  Business trip - Bucharest

── Tasks ───────────────────────────
🟠 High   Draft motion (due today)
⚪ Medium  Research precedents (due today)
```

---

## Rationale

1. **Data Layer First**: Reusable hooks reduce duplication and ensure consistent loading/error handling across all pages.

2. **Skeleton Screens**: Better UX than spinners - maintains layout stability during loading.

3. **Inline Errors**: Non-blocking error display with retry capability.

4. **Calendar Split (Events/Tasks)**: Events have fixed times (meetings, court dates), tasks have deadlines. Different mental models require different UI sections.

5. **Collapsible Calendar**: Maximizes content visibility while keeping date context accessible.

---

## Open Questions for Research

- [ ] Verify `myCalendar` query exists and its exact return shape
- [ ] Check if calendar query needs to be added to `src/graphql/queries.ts`
- [ ] Confirm task filtering works for separating events vs tasks by type
- [ ] Review existing skeleton patterns in codebase (if any)
- [ ] Check how BusinessTrip multi-day display should work in calendar grid

---

## Files to Create/Modify

**New Hooks** (in `src/hooks/`):

- `useCases.ts`
- `useCase.ts`
- `useMyTasks.ts`
- `useTasksByCase.ts`
- `useSearch.ts`
- `useCalendar.ts`

**Update Pages** (in `src/app/m/`):

- `page.tsx` (Home)
- `cases/page.tsx`
- `cases/[id]/page.tsx`
- `search/page.tsx`
- `calendar/page.tsx`

**New Components** (in `src/components/`):

- Skeleton variants for each page
- Inline error component with retry

---

## Next Step

Start a new session and run:

```
/research brainstorm-mobile-wiring
```

This will investigate the open questions and verify the GraphQL queries are available as expected.
