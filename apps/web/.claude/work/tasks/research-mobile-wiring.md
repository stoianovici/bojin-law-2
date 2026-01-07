# Research: Mobile UI Data Wiring

**Status**: Complete
**Date**: 2024-12-31
**Input**: `brainstorm-mobile-wiring.md`
**Next step**: `/plan research-mobile-wiring`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Tech Stack**: Next.js 16, TypeScript, Apollo Client 4, Zustand, Tailwind CSS
**Backend**: bojin-law-2 GraphQL gateway at `http://localhost:4000/graphql`

**Current State**:

- 5 mobile pages exist with hardcoded data
- Apollo Client fully configured with auth headers
- Most GraphQL queries exist in `src/graphql/queries.ts`
- Need to replace hardcoded data with real backend queries

---

## Problem Statement

Replace hardcoded content in mobile UI with real data from backend. Create reusable data hooks, implement skeleton loading states, and inline error handling.

---

## Research Findings

### 1. Existing GraphQL Queries

**Location**: `src/graphql/queries.ts`

| Query               | Parameters                      | Status                       |
| ------------------- | ------------------------------- | ---------------------------- |
| `GET_CASES`         | `status?`, `assignedToMe?`      | Available                    |
| `GET_CASE`          | `id!`                           | Available                    |
| `SEARCH_CASES`      | `query!`, `limit?`              | Available                    |
| `GET_TASKS`         | `filters?`, `limit?`, `offset?` | Available                    |
| `GET_MY_TASKS`      | `filters?`                      | Available                    |
| `GET_TASKS_BY_CASE` | `caseId!`, `filters?`           | Available                    |
| `myCalendar`        | `dateRange?`                    | **MISSING - NEEDS CREATION** |

**Query Return Shapes**:

```typescript
// GET_CASES / GET_CASE returns
interface Case {
  id: UUID;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  type: string;
  description: string;
  openedDate: string;
  closedDate?: string;
  client: { id; name; contactInfo?; address? };
  teamMembers: Array<{ id; role; user: { id; firstName; lastName; email?; role? } }>;
  actors?: Array<{ id; name; role; organization?; email?; phone? }>;
  createdAt: string;
  updatedAt: string;
}

// GET_TASKS / GET_MY_TASKS returns
interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType; // Research | DocumentCreation | DocumentRetrieval | CourtDate | Meeting | BusinessTrip
  status: TaskStatus; // Pending | InProgress | Completed | Cancelled
  priority: TaskPriority; // Low | Medium | High | Urgent
  dueDate: string;
  dueTime?: string;
  case: { id; caseNumber; title };
  assignee: { id; firstName; lastName };
  createdAt: string;
  completedAt?: string;
}
```

### 2. Existing Hook Patterns

**Location**: `src/hooks/`

**Pattern Used**: Custom `useGraphQL` wrapper around Apollo's `useQuery`

```typescript
// From src/hooks/useGraphQL.ts
function useQuery<T>(query, variables?) {
  return { data, loading, error, refetch };
}
```

**Existing Hooks to Reference**:
| Hook | Pattern | File |
|------|---------|------|
| `useGraphQL` | Core Apollo wrapper | `src/hooks/useGraphQL.ts` |
| `useEmailsByCase` | Query with pagination | `src/hooks/useEmailsByCase.ts` |
| `useEmailThread` | Conditional fetching (skip) | `src/hooks/useEmailThread.ts` |
| `useTemplates` | Query + Mutation combo | `src/hooks/useTemplates.ts` |
| `useMapa` | Complex CRUD operations | `src/hooks/useMapa.ts` |

### 3. Authentication & User Context

**How to get current user**:

```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, isAuthenticated, isLoading } = useAuth();
// user: { id, email, name, role, firmId }
```

**Auth Headers**: Automatically injected by Apollo Client via:

- `x-mock-user`: JSON with userId, firmId, role, email
- `x-ms-access-token`: MS Graph token

**No ME query needed** - user context passed via headers.

### 4. Mobile Pages Current State

| Page        | Route           | Current Data                     | Query Needed                           |
| ----------- | --------------- | -------------------------------- | -------------------------------------- |
| Home        | `/m`            | Hardcoded attention items, tasks | `GET_MY_TASKS`, `useAuth` for greeting |
| Cases       | `/m/cases`      | Hardcoded case list              | `GET_CASES`                            |
| Case Detail | `/m/cases/[id]` | Hardcoded case + tasks           | `GET_CASE` + `GET_TASKS_BY_CASE`       |
| Search      | `/m/search`     | Hardcoded mock results           | `SEARCH_CASES` + new unified search    |
| Calendar    | `/m/calendar`   | Hardcoded events                 | **New `myCalendar` query**             |

### 5. Loading/Skeleton Components

**Status**: No dedicated skeleton components exist.

**Current Pattern**:

- `Loader2` spinner from lucide-react
- Conditional rendering: `{loading && <Loader />}`
- Button has built-in `loading` prop

**Need to Create**: Mobile-optimized skeleton components matching mockup layouts.

### 6. Error Handling Patterns

**Current Pattern**:

- Error stored in state
- Conditional rendering: `{error && <ErrorMessage />}`
- Toast notifications for mutations
- Tooltip display for status errors

**Need to Create**: Inline error component with retry button.

### 7. Backend Task Type Schema

**Task Types** (from `bojin-law-2/services/gateway/src/graphql/schema/`):

**Events (Fixed Time)** - for Calendar Events section:
| Type | Key Metadata Fields |
|------|---------------------|
| `Meeting` | meetingType, location, virtualMeetingUrl, agenda |
| `CourtDate` | courtName, courtRoom, caseNumber, hearingType, judge |
| `BusinessTrip` | destination, purpose, delegatedTasks |

**Tasks (Deadline-Based)** - for Calendar Tasks section:
| Type | Key Metadata Fields |
|------|---------------------|
| `Research` | researchTopic, jurisdiction, sources, findings |
| `DocumentCreation` | documentType, templateId, draftStatus |
| `DocumentRetrieval` | documentDescription, sourceLocation, retrievalMethod |

**All-Day Logic**:

- Timed: `dueDate` + `dueTime` present
- All-day: `dueDate` only, `dueTime` is null
- Multi-day: BusinessTrip spans delegation period

---

## Implementation Recommendation

### Phase 1: Create Data Layer Hooks

Create 6 hooks in `src/hooks/mobile/`:

```typescript
// Hook signature pattern
function useXXX(params?) {
  return { data, loading, error, refetch };
}
```

1. **useCases.ts** - Wraps `GET_CASES`
2. **useCase.ts** - Wraps `GET_CASE`
3. **useMyTasks.ts** - Wraps `GET_MY_TASKS`
4. **useTasksByCase.ts** - Wraps `GET_TASKS_BY_CASE`
5. **useSearch.ts** - Wraps `SEARCH_CASES`
6. **useCalendar.ts** - Wraps new `myCalendar` query + separates events/tasks

### Phase 2: Add Missing Calendar Query

Add to `src/graphql/queries.ts`:

```graphql
query MyCalendar($startDate: Date!, $endDate: Date!) {
  myTasks(filters: { dueDateFrom: $startDate, dueDateTo: $endDate }) {
    id
    title
    type
    status
    priority
    dueDate
    dueTime
    case {
      id
      caseNumber
      title
    }
    typeMetadata
  }
}
```

### Phase 3: Create Skeleton Components

Create in `src/components/mobile/`:

- `MobileHomeSkeleton.tsx`
- `MobileCasesSkeleton.tsx`
- `MobileCaseDetailSkeleton.tsx`
- `MobileSearchSkeleton.tsx`
- `MobileCalendarSkeleton.tsx`

### Phase 4: Create Error Component

Create `src/components/mobile/InlineError.tsx`:

```tsx
interface Props {
  message: string;
  onRetry: () => void;
}
```

### Phase 5: Wire Pages

Update each mobile page to use hooks with proper loading/error states.

---

## File Plan

| File                                    | Action | Purpose                                  |
| --------------------------------------- | ------ | ---------------------------------------- |
| `src/graphql/queries.ts`                | Modify | Add myCalendar query                     |
| `src/hooks/mobile/useCases.ts`          | Create | Cases list hook                          |
| `src/hooks/mobile/useCase.ts`           | Create | Single case hook                         |
| `src/hooks/mobile/useMyTasks.ts`        | Create | User's tasks hook                        |
| `src/hooks/mobile/useTasksByCase.ts`    | Create | Case tasks hook                          |
| `src/hooks/mobile/useSearch.ts`         | Create | Search hook                              |
| `src/hooks/mobile/useCalendar.ts`       | Create | Calendar hook with event/task separation |
| `src/hooks/mobile/index.ts`             | Create | Barrel export                            |
| `src/components/mobile/skeletons/`      | Create | Skeleton components                      |
| `src/components/mobile/InlineError.tsx` | Create | Error with retry                         |
| `src/app/m/page.tsx`                    | Modify | Wire to hooks                            |
| `src/app/m/cases/page.tsx`              | Modify | Wire to hooks                            |
| `src/app/m/cases/[id]/page.tsx`         | Modify | Wire to hooks                            |
| `src/app/m/search/page.tsx`             | Modify | Wire to hooks                            |
| `src/app/m/calendar/page.tsx`           | Modify | Wire to hooks                            |

---

## Patterns to Follow

### Hook Pattern (from existing codebase)

```typescript
// src/hooks/mobile/useCases.ts
import { useQuery } from '@apollo/client';
import { GET_CASES } from '@/graphql/queries';

interface UseCasesOptions {
  status?: string;
  assignedToMe?: boolean;
}

export function useCases(options: UseCasesOptions = {}) {
  const { data, loading, error, refetch } = useQuery(GET_CASES, {
    variables: options,
    fetchPolicy: 'cache-and-network',
  });

  return {
    cases: data?.cases ?? [],
    loading,
    error,
    refetch,
  };
}
```

### Skeleton Pattern (to create)

```typescript
// src/components/mobile/skeletons/CaseCardSkeleton.tsx
export function CaseCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4 animate-pulse">
      <div className="h-5 bg-[#2a2a2a] rounded w-3/4 mb-2" />
      <div className="h-4 bg-[#2a2a2a] rounded w-1/2" />
    </div>
  );
}
```

### Error Pattern (to create)

```typescript
// src/components/mobile/InlineError.tsx
interface InlineErrorProps {
  message: string;
  onRetry: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
      <p className="text-red-400 text-sm mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="text-blue-400 text-sm font-medium"
      >
        Încearcă din nou
      </button>
    </div>
  );
}
```

---

## Risks & Mitigations

| Risk                                      | Mitigation                                             |
| ----------------------------------------- | ------------------------------------------------------ |
| myCalendar query may not exist in backend | Use GET_MY_TASKS with date filter as fallback          |
| Task metadata parsing for calendar types  | Create utility function to safely extract typeMetadata |
| Search needs unified endpoint             | Start with SEARCH_CASES, expand later                  |
| Skeleton layout mismatch                  | Build skeletons after mockup verification              |

---

## Open Questions Resolved

- [x] **myCalendar query**: Does NOT exist - use GET_MY_TASKS with date filtering
- [x] **Skeleton patterns**: None exist - need to create mobile-specific ones
- [x] **Task type filtering**: Backend supports filtering by type via TaskFilterInput
- [x] **BusinessTrip multi-day**: Uses delegation period dates from typeMetadata
- [x] **User greeting**: Use `useAuth()` hook to get `user.name`

---

## Next Step

Start a new session and run:

```
/plan research-mobile-wiring
```
