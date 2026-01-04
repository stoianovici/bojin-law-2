# Research: New Task & Event Interactions

**Status**: Complete
**Date**: 2025-01-02
**Input**: `brainstorm-new-interactions.md`
**Next step**: `/plan research-new-interactions`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Radix UI, Zustand, Apollo GraphQL
**Target**: Desktop UI first
**Design System**: Linear-inspired dark theme with CSS custom properties

**Problem**: Users need to create tasks/events via:

1. Header "+" button (context-aware)
2. Calendar slot clicks with floating popover
3. Keyboard shortcuts (T/E in calendar view)

---

## Research Findings

### 1. Radix UI Primitives Analysis

**Installed Packages** (already available):

```
@radix-ui/react-popover@^1.1.15    ← Form container with arrow
@radix-ui/react-dropdown-menu@^2.0.0  ← Context menu
@radix-ui/react-dialog@^1.0.0      ← Fallback for complex forms
@radix-ui/react-select@^2.2.6      ← Field selects
@radix-ui/react-tooltip@^1.2.8
```

**Existing Popover Wrapper**: `src/components/ui/Popover.tsx`

- Pre-configured with `align="center"`, `side="bottom"`, `sideOffset=4`
- Has `PopoverArrow` styled with `fill-linear-bg-elevated`
- Supports animations: `data-[side=*]` with slide animations
- Includes `PopoverAnchor` for custom positioning

**Existing DropdownMenu**: `src/components/ui/DropdownMenu.tsx`

- Supports items, sub-menus, separators
- Portal rendering for z-index stacking
- Default `sideOffset=4`

**Smart Positioning**: Built into Radix (uses Floating UI internally)

- `avoidCollisions` - enabled by default
- `collisionPadding` - default 8px
- Auto-flips to opposite side when near viewport edge

**Recommended Approach**:

```
Calendar Click → DropdownMenu ("New Task" / "New Event")
                      ↓
               Popover + PopoverAnchor (form with arrow)
```

**Reference Pattern**: `src/components/tasks/TaskActionPopover.tsx`

- Multi-view popover (menu → form views)
- Uses useState to toggle views
- Handles `e.stopPropagation()` for click events

### 2. Calendar Component Analysis

**Component Structure**:

```
src/components/calendar/
├── TimeGrid.tsx              - Time labels (8-18h), read-only
├── DayColumn.tsx             - Day column with slots, events, tasks
├── CalendarWeekHeader.tsx    - Week header (Mon-Fri)
├── AllDayRow.tsx             - All-day events area
├── CalendarEvent.tsx         - Event blocks
├── TaskCard.tsx              - Task cards (draggable)
└── CalendarFilters.tsx       - Filter sidebar
```

**DayColumn.tsx** (main interaction target):

- Hour slots rendered as divs with 48px height each
- Already has callback props: `onTaskClick`, `onEventClick`, `onTaskDrop`
- Event click handlers with keyboard support implemented
- No slot click handler yet (needs to be added)

**How to Add Slot Click**:

```typescript
// Add to DayColumnProps interface
onSlotClick?: (date: Date, hour: number, minute: number, position: { x: number, y: number }) => void;

// Modify hour slot rendering (lines 174-183)
{hourSlots.map((hour) => (
  <div
    key={hour}
    className="border-b border-linear-border-subtle relative cursor-pointer hover:bg-linear-bg-tertiary/50"
    style={{ height: `${HOUR_HEIGHT}px` }}
    onClick={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const minute = Math.round((clickY / HOUR_HEIGHT) * 60);
      onSlotClick?.(date, hour, minute, { x: e.clientX, y: e.clientY });
    }}
  >
    {/* half-hour divider */}
  </div>
))}
```

**Available Data on Click**:

- `date: Date` - The day being clicked
- `hour: number` - Hour slot (8-17)
- `minute: number` - Calculated from click position
- `position: {x, y}` - Screen coordinates for popover anchor

**Calendar Page**: `src/app/(dashboard)/calendar/page.tsx`

- Already has stub: `handleNewEvent` (line 333)
- Passes callbacks to DayColumn components

### 3. GraphQL Mutations

**CREATE_TASK** (exists): `src/graphql/mutations.ts:105-127`

```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    type
    status
    dueDate
    dueTime
    priority
    case {
      id
      title
    }
    assignee {
      id
      firstName
      lastName
    }
    createdAt
  }
}
```

**CreateTaskInput** (inferred):

```typescript
interface CreateTaskInput {
  caseId: string; // Required
  title: string; // Required
  type: TaskType; // 'Research' | 'DocumentCreation' | 'CourtDate' | 'Meeting' | etc.
  assignedTo: string; // Required (user ID)
  dueDate: string; // Required (YYYY-MM-DD)
  dueTime?: string; // Optional (HH:MM)
  description?: string;
  priority?: TaskPriority; // 'Low' | 'Medium' | 'High' | 'Urgent'
  estimatedHours?: number;
}
```

**CREATE_EVENT** (does not exist):

- Events currently use CREATE_TASK with type: 'Meeting' | 'CourtDate' | 'BusinessTrip'
- May need new mutation for proper event support with attendees

**Existing Hook**: `src/hooks/mobile/useCreateTask.ts`

```typescript
export function useCreateTask() {
  const [createTaskMutation, { loading, error }] = useMutation(CREATE_TASK);
  const createTask = async (input: CreateTaskInput) => {
    const result = await createTaskMutation({ variables: { input } });
    return result.data?.createTask;
  };
  return { createTask, loading, error };
}
```

**Cache Pattern**: Uses `refetchQueries` (no optimistic updates)

```typescript
refetchQueries: [{ query: GET_TASKS_BY_CASE, variables: { caseId } }];
```

### 4. Form Patterns

**Validation Approach**: Local state (no react-hook-form/formik)

```typescript
const [formData, setFormData] = useState<FormData>({...});
const [errors, setErrors] = useState<Record<string, string>>({});
const [touched, setTouched] = useState<Record<string, boolean>>({});

const validateForm = useCallback((): FormErrors => {
  const newErrors: FormErrors = {};
  if (!formData.title.trim()) newErrors.title = 'Title is required';
  // ... more validations
  return newErrors;
}, [formData]);
```

**Available Field Components**:
| Component | Location | Features |
|-----------|----------|----------|
| Input | `src/components/ui/Input.tsx` | error, errorMessage, leftAddon, rightAddon |
| TextArea | `src/components/ui/Input.tsx` | autoResize, resize variants |
| Select | `src/components/ui/Select.tsx` | Radix-based, sm/md/lg sizes |
| Checkbox | `src/components/ui/Checkbox.tsx` | Indeterminate support |
| TagInput | `src/components/cases/TagInput.tsx` | Multi-value with chips |
| TeamMemberSelect | `src/components/cases/TeamMemberSelect.tsx` | User multi-select with roles |

**Date Input**: Native HTML5 `<input type="date">` (no date picker library)

**Form Layout Pattern**:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-linear-text-secondary">
    Label <span className="text-linear-error">*</span>
  </label>
  <Input error={!!errors.field} errorMessage={errors.field} />
</div>
```

**Button Pattern**:

```tsx
<Button type="submit" disabled={loading || !isValid} loading={loading}>
  {loading ? 'Creating...' : 'Create'}
</Button>
```

### 5. User/Team Member Data

**TeamMember Type**: `src/hooks/mobile/useTeamMembers.ts`

```typescript
interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'LAWYER' | 'PARALEGAL';
  avatarUrl: string | null;
}
```

**Current User Access**: Zustand store

```typescript
const { user } = useAuthStore();
// user: { id, email, name, role, firmId }
```

**Fetch Team Members**:

```typescript
import { useTeamMembers } from '@/hooks/mobile/useTeamMembers';
const { members, loading } = useTeamMembers();
```

**Avatar Component**: `src/components/ui/Avatar.tsx`

- Sizes: xs, sm, md, lg
- Initials fallback from name
- Status indicator support

**TeamMemberSelect Component** (reusable):

- Desktop: `src/components/cases/TeamMemberSelect.tsx`
- Mobile: `src/components/mobile/TeamMemberSelect.tsx`
- Multi-select with role assignment (Lead/Support/Observer)

---

## Implementation Recommendation

### Component Structure

```
src/components/
├── forms/
│   ├── TaskForm.tsx              # Task creation form (reusable)
│   ├── EventForm.tsx             # Event creation form (reusable)
│   └── fields/
│       ├── CaseSearchField.tsx   # Case search/select with debounce
│       ├── DateTimeField.tsx     # Combined date + time inputs
│       └── DurationInput.tsx     # Estimated time (hours:minutes)
├── popovers/
│   ├── SlotContextMenu.tsx       # "New Task" / "New Event" dropdown
│   └── CreateFormPopover.tsx     # Popover wrapper for forms
└── calendar/
    └── (existing - modify DayColumn.tsx)
```

### Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CALENDAR SLOT CLICK                       │
├─────────────────────────────────────────────────────────────┤
│  1. User clicks calendar time slot                          │
│  2. DayColumn fires onSlotClick(date, hour, minute, pos)    │
│  3. Calendar page opens SlotContextMenu at click position   │
│  4. User selects "New Task" or "New Event"                  │
│  5. CreateFormPopover opens with TaskForm or EventForm      │
│  6. Form pre-fills: date/time from slot, assignee = self    │
│  7. User fills required fields, submits                     │
│  8. Mutation fires, popover closes, calendar refetches      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    HEADER "+" BUTTON                         │
├─────────────────────────────────────────────────────────────┤
│  Calendar view → Opens Event form directly (modal/popover)  │
│  Tasks view    → Opens Task form directly                   │
│  Other views   → Opens context menu (Task/Event choice)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    KEYBOARD SHORTCUTS                        │
├─────────────────────────────────────────────────────────────┤
│  T (in calendar) → Open TaskForm popover (no pre-fill)      │
│  E (in calendar) → Open EventForm popover (no pre-fill)     │
└─────────────────────────────────────────────────────────────┘
```

---

## File Plan

| File                                              | Action | Purpose                                     |
| ------------------------------------------------- | ------ | ------------------------------------------- |
| `src/components/calendar/DayColumn.tsx`           | Modify | Add `onSlotClick` prop and click handlers   |
| `src/components/popovers/SlotContextMenu.tsx`     | Create | DropdownMenu for "New Task" / "New Event"   |
| `src/components/popovers/CreateFormPopover.tsx`   | Create | Popover wrapper with anchor positioning     |
| `src/components/forms/TaskForm.tsx`               | Create | Reusable task creation form                 |
| `src/components/forms/EventForm.tsx`              | Create | Reusable event creation form                |
| `src/components/forms/fields/CaseSearchField.tsx` | Create | Case search with autocomplete               |
| `src/components/forms/fields/DateTimeField.tsx`   | Create | Combined date + time input                  |
| `src/app/(dashboard)/calendar/page.tsx`           | Modify | Add slot click handling, keyboard shortcuts |
| `src/graphql/mutations.ts`                        | Modify | Add CREATE_EVENT mutation (if needed)       |
| `src/hooks/useCreateEvent.ts`                     | Create | Event creation hook (if separate from task) |
| `src/components/layout/Header.tsx`                | Modify | Make "+" button context-aware               |

---

## Risks & Mitigations

| Risk                          | Impact                           | Mitigation                                                           |
| ----------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| No CREATE_EVENT mutation      | Events can't have attendees list | Either: (1) Use task with 'Meeting' type, or (2) Create new mutation |
| Popover positioning on mobile | May not fit screen               | Use Dialog fallback for small viewports                              |
| Form validation complexity    | Slow dev                         | Start with minimal validation, iterate                               |
| Keyboard shortcuts conflict   | Other handlers may capture       | Use event.key check with modifier awareness                          |

---

## Design Tokens Reference

```css
/* Backgrounds */
bg-linear-bg-primary     /* #0a0a0a - darkest */
bg-linear-bg-secondary   /* #141414 - cards */
bg-linear-bg-elevated    /* #1a1a1a - inputs, popovers */
bg-linear-bg-tertiary    /* hover states */

/* Text */
text-linear-text-primary    /* #fafafa */
text-linear-text-secondary  /* #a1a1a1 - labels */
text-linear-text-tertiary   /* #6b6b6b - hints */

/* Borders */
border-linear-border-subtle  /* default borders */

/* Status */
text-linear-error    /* validation errors */
text-linear-accent   /* #3b82f6 - focus/primary */
text-linear-success  /* #22c55e */
text-linear-warning  /* #f59e0b */

/* Z-Index */
z-linear-dropdown   /* context menus */
z-linear-popover    /* form popovers */
z-linear-modal      /* dialogs */
```

---

## Next Step

Start a new session and run:

```
/plan research-new-interactions
```
