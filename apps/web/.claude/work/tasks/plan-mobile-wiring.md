# Plan: Mobile UI Data Wiring

**Status**: Approved
**Date**: 2024-12-31
**Input**: `research-mobile-wiring.md`
**Next step**: `/implement plan-mobile-wiring`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Tech Stack**: Next.js 16, TypeScript, Apollo Client 4, Zustand, Tailwind CSS
**Backend**: bojin-law-2 GraphQL gateway at `http://localhost:4000/graphql`

**Key Files**:

- Queries: `src/graphql/queries.ts` (GET_CASES, GET_CASE, GET_MY_TASKS, GET_TASKS_BY_CASE, SEARCH_CASES)
- Auth: `src/hooks/useAuth.ts` - provides `{ user, isAuthenticated, isLoading }`
- Mobile pages: `src/app/m/**/*.tsx`

**Design Tokens**:

```
Backgrounds: #0a0a0a (primary) → #141414 (elevated) → #1a1a1a (card)
Text: #fafafa (primary) → #a1a1a1 (secondary) → #6b6b6b (tertiary)
Accent: #3b82f6 (blue), #f59e0b (warning), #22c55e (success)
```

## Approach Summary

Create 6 data-fetching hooks in `src/hooks/mobile/` that wrap existing GraphQL queries. Add skeleton loading components and an inline error component with retry. Wire all 5 mobile pages to use these hooks, replacing hardcoded data with real backend queries.

---

## Parallel Group 1: Core Data Hooks

> These tasks run simultaneously via sub-agents

### Task 1.1: Create useCases hook

- **File**: `src/hooks/mobile/useCases.ts` (CREATE)
- **Do**: Create hook wrapping GET_CASES query. Accept optional `status` and `assignedToMe` params. Return `{ cases, loading, error, refetch }`. Use `fetchPolicy: 'cache-and-network'`.
- **Done when**: Hook compiles and exports correctly

### Task 1.2: Create useCase hook

- **File**: `src/hooks/mobile/useCase.ts` (CREATE)
- **Do**: Create hook wrapping GET_CASE query. Accept required `id` param. Return `{ case: caseData, loading, error, refetch }`. Skip query if no id.
- **Done when**: Hook compiles and exports correctly

### Task 1.3: Create useMyTasks hook

- **File**: `src/hooks/mobile/useMyTasks.ts` (CREATE)
- **Do**: Create hook wrapping GET_MY_TASKS query. Accept optional filters object. Return `{ tasks, loading, error, refetch }`.
- **Done when**: Hook compiles and exports correctly

### Task 1.4: Create useTasksByCase hook

- **File**: `src/hooks/mobile/useTasksByCase.ts` (CREATE)
- **Do**: Create hook wrapping GET_TASKS_BY_CASE query. Accept required `caseId` and optional `filters`. Return `{ tasks, loading, error, refetch }`. Skip if no caseId.
- **Done when**: Hook compiles and exports correctly

### Task 1.5: Create useSearch hook

- **File**: `src/hooks/mobile/useSearch.ts` (CREATE)
- **Do**: Create hook wrapping SEARCH_CASES query. Accept `query` string and optional `limit`. Return `{ results, loading, error, search }`. Use `useLazyQuery` for on-demand searching.
- **Done when**: Hook compiles and exports correctly

---

## Parallel Group 2: Calendar Hook + Shared Components

> These tasks run simultaneously via sub-agents

### Task 2.1: Create useCalendar hook

- **File**: `src/hooks/mobile/useCalendar.ts` (CREATE)
- **Do**: Create hook using GET_MY_TASKS with date range filter. Accept `startDate` and `endDate`. Separate results into `events` (Meeting, CourtDate, BusinessTrip types) and `tasks` (Research, DocumentCreation, DocumentRetrieval types). Return `{ events, tasks, loading, error, refetch }`.
- **Done when**: Hook correctly separates events from tasks by type

### Task 2.2: Create hooks barrel export

- **File**: `src/hooks/mobile/index.ts` (CREATE)
- **Do**: Create barrel file exporting all 6 hooks: useCases, useCase, useMyTasks, useTasksByCase, useSearch, useCalendar.
- **Done when**: All hooks importable from `@/hooks/mobile`

### Task 2.3: Create InlineError component

- **File**: `src/components/mobile/InlineError.tsx` (CREATE)
- **Do**: Create error component with message and retry button. Props: `{ message: string, onRetry: () => void }`. Use red-tinted background (#ef4444/10), red border, red text for message, blue text for retry button. Romanian text "Încearcă din nou" for retry.
- **Done when**: Component renders error message with clickable retry

### Task 2.4: Create skeleton components

- **File**: `src/components/mobile/skeletons/index.ts` (CREATE)
- **Do**: Create skeleton directory with components for each page layout. Include: `CaseCardSkeleton`, `TaskCardSkeleton`, `CalendarDaySkeleton`, `SearchResultSkeleton`. Use `animate-pulse` with #2a2a2a background on #1a1a1a cards. Export all from index.ts.
- **Done when**: All skeleton components render placeholder shapes matching card layouts

---

## Parallel Group 3: Wire Mobile Pages

> These tasks run simultaneously via sub-agents

### Task 3.1: Wire Home page

- **File**: `src/app/m/page.tsx` (MODIFY)
- **Do**: Import `useMyTasks` from `@/hooks/mobile` and `useAuth` from `@/hooks/useAuth`. Replace hardcoded greeting with user.name. Replace hardcoded tasks with real data. Show skeleton during loading. Show InlineError on error with refetch as retry. Keep existing UI structure.
- **Done when**: Page shows real user name and real tasks from backend

### Task 3.2: Wire Cases page

- **File**: `src/app/m/cases/page.tsx` (MODIFY)
- **Do**: Import `useCases` from `@/hooks/mobile`. Replace hardcoded case list with real data. Show CaseCardSkeleton during loading. Show InlineError on error. Keep existing card design and navigation.
- **Done when**: Page shows real cases from backend

### Task 3.3: Wire Case Detail page

- **File**: `src/app/m/cases/[id]/page.tsx` (MODIFY)
- **Do**: Import `useCase` and `useTasksByCase` from `@/hooks/mobile`. Get id from params. Replace hardcoded case and tasks with real data. Show skeleton during loading. Show InlineError on error. Keep existing UI sections (info, timeline, tasks).
- **Done when**: Page shows real case details and associated tasks

### Task 3.4: Wire Search page

- **File**: `src/app/m/search/page.tsx` (MODIFY)
- **Do**: Import `useSearch` from `@/hooks/mobile`. Connect search input to hook. Show results from query instead of hardcoded data. Show skeleton during search. Show InlineError on error. Keep existing search UI.
- **Done when**: Search returns real results from backend

### Task 3.5: Wire Calendar page

- **File**: `src/app/m/calendar/page.tsx` (MODIFY)
- **Do**: Import `useCalendar` from `@/hooks/mobile`. Pass current week's date range. Use `events` for timed items section, `tasks` for deadline items section. Show skeleton during loading. Show InlineError on error. Keep existing calendar UI structure.
- **Done when**: Calendar shows real events and tasks from backend

---

## Final Steps (Sequential)

### Task 4: Integration Testing

- **Depends on**: All Group 3 tasks
- **Do**: Run `npm run type-check` to verify no TypeScript errors. Run `npm run dev` and manually verify each of the 5 mobile pages loads with real data from backend.
- **Done when**: Type check passes, all pages render correctly with backend data

---

## Session Scope Assessment

- **Total tasks**: 14
- **Estimated complexity**: Medium-Complex
- **Checkpoint recommended at**: After Group 2 (before wiring pages)

## Next Step

Start a new session and run:

```
/implement plan-mobile-wiring
```
