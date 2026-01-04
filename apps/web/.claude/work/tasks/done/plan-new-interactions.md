# Plan: New Task & Event Interactions

**Status**: Approved
**Date**: 2025-01-02
**Input**: `research-new-interactions.md`
**Next step**: `/implement plan-new-interactions`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Radix UI, Zustand, Apollo GraphQL
**Design System**: Linear-inspired dark theme with CSS custom properties

**Key Patterns**:

- Popovers: Use `src/components/ui/Popover.tsx` (Radix-based with arrows)
- Dropdowns: Use `src/components/ui/DropdownMenu.tsx`
- Forms: Local state validation (no form library)
- Mutations: Apollo `useMutation` with `refetchQueries`

## Approach Summary

Implement three interaction methods for creating tasks/events:

1. **Calendar slot click** → Context menu → Form popover (pre-filled date/time)
2. **Header "+" button** → Context-aware (calendar→event, tasks→task, other→menu)
3. **Keyboard shortcuts** → T/E keys globally on calendar page

Forms are reusable components. A new CREATE_EVENT mutation will be added to support events with attendees (distinct from tasks).

---

## Parallel Group 1: Foundation

> 5 tasks - no file conflicts

### Task 1.1: DateTimeField Component

- **File**: `src/components/forms/fields/DateTimeField.tsx` (CREATE)
- **Do**:
  - Create combined date + time input field
  - Props: `date`, `time`, `onDateChange`, `onTimeChange`, `required`, `error`
  - Use native `<input type="date">` and `<input type="time">`
  - Layout: side-by-side on desktop, stacked on mobile
  - Style with existing Input component patterns
- **Done when**: Component renders, accepts/emits date and time values, shows error state

### Task 1.2: CaseSearchField Component

- **File**: `src/components/forms/fields/CaseSearchField.tsx` (CREATE)
- **Do**:
  - Create case search/select with autocomplete
  - Use existing `GET_CASES` query with search variable
  - Debounce search input (300ms)
  - Show case title + case number in dropdown
  - Props: `value`, `onChange`, `error`, `required`
  - Use Radix Popover for dropdown list
- **Done when**: Can search cases, select one, displays selected case, clears selection

### Task 1.3: SlotContextMenu Component

- **File**: `src/components/popovers/SlotContextMenu.tsx` (CREATE)
- **Do**:
  - Create DropdownMenu with "New Task" and "New Event" options
  - Props: `open`, `onOpenChange`, `position: {x, y}`, `onSelectTask`, `onSelectEvent`
  - Use `DropdownMenu` from `src/components/ui/DropdownMenu.tsx`
  - Position at click coordinates using DropdownMenu's positioning
  - Icons: use Lucide icons (CheckSquare for task, Calendar for event)
- **Done when**: Menu appears at position, clicking options fires callbacks, closes on selection

### Task 1.4: CreateFormPopover Component

- **File**: `src/components/popovers/CreateFormPopover.tsx` (CREATE)
- **Do**:
  - Create popover wrapper for forms with anchor positioning
  - Props: `open`, `onOpenChange`, `position: {x, y}`, `children`, `title`
  - Use `Popover` + `PopoverAnchor` from `src/components/ui/Popover.tsx`
  - Include header with title and close button
  - Max width: 400px, max height: 80vh with scroll
  - Handle click-outside to close
- **Done when**: Popover renders at position, shows title, closes properly, scrolls if content overflows

### Task 1.5: CREATE_EVENT Mutation (Backend + Frontend)

- **File**: `src/graphql/mutations.ts` (MODIFY)
- **Do**:
  - Add CREATE_EVENT mutation:
    ```graphql
    mutation CreateEvent($input: CreateEventInput!) {
      createEvent(input: $input) {
        id
        title
        type
        startDate
        startTime
        endDate
        endTime
        location
        description
        case {
          id
          title
        }
        attendees {
          id
          firstName
          lastName
        }
        createdAt
      }
    }
    ```
  - Define CreateEventInput type in comments for backend reference
  - Note: Backend implementation needed (out of scope for this plan)
- **Done when**: Mutation exported, TypeScript types defined

---

## Parallel Group 2: Hooks

> 1 task - after Group 1 (needs mutation)

### Task 2.1: useCreateEvent Hook

- **File**: `src/hooks/useCreateEvent.ts` (CREATE)
- **Do**:
  - Create event creation hook using CREATE_EVENT mutation
  - Follow pattern from `src/hooks/mobile/useCreateTask.ts`
  - Return: `{ createEvent, loading, error }`
  - Handle refetchQueries for calendar data
- **Done when**: Hook can call mutation, returns loading/error states

---

## Parallel Group 3: Forms

> 2 tasks - after Group 1 (needs fields)

### Task 3.1: TaskForm Component

- **File**: `src/components/forms/TaskForm.tsx` (CREATE)
- **Do**:
  - Create reusable task creation form
  - Fields: title*, case*, assignee*, date*, time, type, priority, description
  - Use: Input, Select, TextArea, DateTimeField, CaseSearchField, TeamMemberSelect
  - Pre-fill props: `defaultDate`, `defaultTime`, `defaultAssignee`
  - Validation: title required, case required, assignee required, date required
  - Submit calls `useCreateTask` hook
  - Props: `onSuccess`, `onCancel`, `defaults`
- **Done when**: Form renders all fields, validates, submits successfully, calls onSuccess

### Task 3.2: EventForm Component

- **File**: `src/components/forms/EventForm.tsx` (CREATE)
- **Do**:
  - Create reusable event creation form
  - Fields: title*, case*, start date/time\*, end date/time, type, location, attendees, description
  - Use: Input, Select, TextArea, DateTimeField, CaseSearchField, TeamMemberSelect
  - Pre-fill props: `defaultDate`, `defaultTime`
  - Validation: title required, case required, start date/time required
  - Submit calls `useCreateEvent` hook
  - Props: `onSuccess`, `onCancel`, `defaults`
- **Done when**: Form renders all fields, validates, submits successfully, calls onSuccess

---

## Sequential: Integration

### Task 4: DayColumn Slot Click

- **Depends on**: None (can start immediately)
- **File**: `src/components/calendar/DayColumn.tsx` (MODIFY)
- **Do**:
  - Add `onSlotClick` prop to DayColumnProps interface
  - Signature: `onSlotClick?: (date: Date, hour: number, minute: number, position: { x: number, y: number }) => void`
  - Add click handler to hour slot divs (lines ~174-183)
  - Calculate minute from click Y position within slot
  - Add hover state: `cursor-pointer hover:bg-linear-bg-tertiary/50`
  - Prevent event bubbling to avoid conflicts with existing handlers
- **Done when**: Clicking empty slot area fires callback with correct date/time/position

### Task 5: Calendar Page Integration

- **Depends on**: Task 4, Tasks 3.1, 3.2, Task 1.3, Task 1.4
- **File**: `src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Do**:
  - Add state for popover management:
    ```typescript
    const [slotMenuOpen, setSlotMenuOpen] = useState(false);
    const [formPopoverOpen, setFormPopoverOpen] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [formType, setFormType] = useState<'task' | 'event'>('task');
    const [defaultDateTime, setDefaultDateTime] = useState<{
      date: Date;
      hour: number;
      minute: number;
    } | null>(null);
    ```
  - Implement `handleSlotClick` - opens SlotContextMenu
  - Implement `handleSelectTask` / `handleSelectEvent` - opens CreateFormPopover with appropriate form
  - Pass `onSlotClick` to all DayColumn components
  - Add global keyboard listener for T and E keys (only when not in input/textarea)
  - Close popovers on successful form submission
- **Done when**: Full flow works: slot click → menu → form → submit → popover closes

### Task 6: Header Context-Aware Button

- **Depends on**: Tasks 3.1, 3.2, Task 1.4
- **File**: `src/components/layout/Header.tsx` (MODIFY)
- **Do**:
  - Detect current route using `usePathname()`
  - Logic:
    - `/calendar` → Open EventForm directly
    - `/tasks` → Open TaskForm directly
    - Other routes → Show DropdownMenu with Task/Event options
  - Add state for form popover management
  - Render CreateFormPopover with appropriate form
  - Position popover below the "+" button
- **Done when**: "+" button behavior changes based on route, forms open correctly

---

## Final: Testing & Polish

### Task 7: Integration Testing

- **Depends on**: All previous tasks
- **File**: None (manual testing)
- **Do**:
  - Test calendar slot click → task creation flow
  - Test calendar slot click → event creation flow
  - Test header "+" on calendar, tasks, and other pages
  - Test keyboard shortcuts (T and E) on calendar page
  - Verify form validation errors display correctly
  - Verify successful submission closes popover
  - Test popover positioning near viewport edges
  - Run `npm run type-check` and `npm run lint`
- **Done when**: All flows work, no TypeScript errors, no lint errors

---

## Session Scope Assessment

| Metric                     | Value                               |
| -------------------------- | ----------------------------------- |
| **Total tasks**            | 10                                  |
| **Parallel groups**        | 3                                   |
| **Sequential tasks**       | 4                                   |
| **New files**              | 8                                   |
| **Modified files**         | 3                                   |
| **Estimated complexity**   | Medium-High                         |
| **Checkpoint recommended** | After Task 5 (calendar integration) |

## Execution Order

```
Group 1 (parallel): Tasks 1.1, 1.2, 1.3, 1.4, 1.5
         ↓
Group 2 (parallel): Task 2.1
         ↓
Group 3 (parallel): Tasks 3.1, 3.2
         ↓
Sequential: Task 4 → Task 5 → Task 6 → Task 7
```

## Backend Note

The CREATE_EVENT mutation requires backend implementation. For initial testing:

- The mutation will be defined in the frontend
- If backend isn't ready, EventForm can fall back to CREATE_TASK with type='Meeting'
- Add a TODO comment in useCreateEvent hook for backend team

---

## Next Step

Start a new session and run:

```
/implement plan-new-interactions
```
