# Implementation: Mobile UI Data Wiring

**Status**: Complete
**Date**: 2024-12-31
**Plan**: `plan-mobile-wiring.md`
**Next step**: `/iterate implement-mobile-wiring` or `/commit`

---

## Summary

Successfully wired all 5 mobile UI pages to real backend data via GraphQL. Created 6 data-fetching hooks, an inline error component, and skeleton loading components. All pages now display real data from the backend with proper loading and error states.

---

## Files Changed

| File                                                       | Action | Description                               |
| ---------------------------------------------------------- | ------ | ----------------------------------------- |
| `src/hooks/mobile/useCases.ts`                             | CREATE | Hook for fetching cases list with filters |
| `src/hooks/mobile/useCase.ts`                              | CREATE | Hook for fetching single case details     |
| `src/hooks/mobile/useMyTasks.ts`                           | CREATE | Hook for fetching current user's tasks    |
| `src/hooks/mobile/useTasksByCase.ts`                       | CREATE | Hook for fetching tasks by case ID        |
| `src/hooks/mobile/useSearch.ts`                            | CREATE | Lazy query hook for case search           |
| `src/hooks/mobile/useCalendar.ts`                          | CREATE | Hook for calendar events/tasks            |
| `src/hooks/mobile/index.ts`                                | CREATE | Barrel export for all hooks and types     |
| `src/components/mobile/InlineError.tsx`                    | CREATE | Error display with retry button           |
| `src/components/mobile/index.ts`                           | CREATE | Barrel export for mobile components       |
| `src/components/mobile/skeletons/CaseCardSkeleton.tsx`     | CREATE | Loading skeleton for case cards           |
| `src/components/mobile/skeletons/TaskCardSkeleton.tsx`     | CREATE | Loading skeleton for task cards           |
| `src/components/mobile/skeletons/CalendarDaySkeleton.tsx`  | CREATE | Loading skeleton for calendar days        |
| `src/components/mobile/skeletons/SearchResultSkeleton.tsx` | CREATE | Loading skeleton for search results       |
| `src/components/mobile/skeletons/index.ts`                 | CREATE | Barrel export for skeletons               |
| `src/app/m/page.tsx`                                       | MODIFY | Wired to useMyTasks, useAuth              |
| `src/app/m/cases/page.tsx`                                 | MODIFY | Wired to useCases                         |
| `src/app/m/cases/[id]/page.tsx`                            | MODIFY | Wired to useCase, useTasksByCase          |
| `src/app/m/search/page.tsx`                                | MODIFY | Wired to useSearch                        |
| `src/app/m/calendar/page.tsx`                              | MODIFY | Wired to useCalendar                      |

---

## Technical Details

### Apollo Client v4 Import Pattern

All hooks use the correct import path for Apollo Client v4:

```typescript
import { useQuery } from '@apollo/client/react';
```

### Next.js 16 Params Pattern

Case detail page uses React's `use()` to unwrap Promise params:

```typescript
import { use } from 'react';
export default function CaseDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const id = params.id;
  // ...
}
```

### Search Debouncing

Search page implements manual debounce without external dependencies:

```typescript
const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const handleSearchChange = useCallback(
  (value: string) => {
    setQuery(value);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (value.trim()) {
      debounceTimeoutRef.current = setTimeout(() => search(value), 300);
    }
  },
  [search]
);
```

### Calendar Task Type Mapping

Calendar hook separates tasks into events and tasks by type:

- Events: Meeting, CourtDate, BusinessTrip
- Tasks: Research, DocumentCreation, DocumentRetrieval, and other types

---

## Verification

- [x] `npm run type-check` passes
- [x] All hooks export correctly from `@/hooks/mobile`
- [x] All components export correctly from `@/components/mobile`
- [x] Loading states show skeleton components
- [x] Error states show InlineError with retry
- [x] Romanian UI text used throughout

---

## Import Paths

To use the new hooks and components:

```typescript
// Hooks
import {
  useCases,
  useCase,
  useMyTasks,
  useTasksByCase,
  useSearch,
  useCalendar,
} from '@/hooks/mobile';

// Components
import { InlineError } from '@/components/mobile';
import {
  CaseCardSkeleton,
  TaskCardSkeleton,
  CalendarDaySkeleton,
  SearchResultSkeleton,
} from '@/components/mobile/skeletons';
```
