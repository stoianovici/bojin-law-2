# Iteration: Calendar Subtask Completion

**Status**: Review Complete
**Date**: 2026-01-06
**Input**: User feedback - "make the nested subtasks in calendar view finalizeable individually"
**Screenshots**: `.playwright-mcp/iterate-calendar-*.png`
**Next step**: Fix issues via code changes

---

## Inspection Summary

### Components Inspected

| Component       | File                                                  | Issues |
| --------------- | ----------------------------------------------------- | ------ |
| DayColumn       | `apps/web/src/components/calendar/DayColumn.tsx`      | 2      |
| ParentTaskCard  | `apps/web/src/components/calendar/ParentTaskCard.tsx` | 0      |
| CalendarPage    | `apps/web/src/app/(dashboard)/calendar/page.tsx`      | 1      |

---

## Issues Found

### Issue 1: DayColumn - onSubtaskToggle not passed to ParentTaskCard (Unified Mode)

- **Location**: DayColumn component, unified calendar mode rendering
- **File**: `apps/web/src/components/calendar/DayColumn.tsx`
- **Lines**: 529-541
- **What I See**: `ParentTaskCard` is rendered with `onSubtaskClick` but NOT `onSubtaskToggle`. The checkbox in subtasks is rendered but clicking it does nothing because the callback is not wired up.
- **Expected**: `onSubtaskToggle` should be passed to enable subtask completion
- **Code Analysis**:
  ```tsx
  // Current (line 529-541):
  <ParentTaskCard
    key={task.id}
    id={task.id}
    title={task.title}
    caseNumber={task.caseNumber}
    subtasks={task.subtasks}
    isTimeGridMode={true}
    top={top}
    height={totalHeight}
    onParentClick={(e) => handleTaskClickForDetail(task.id, e)}
    onSubtaskClick={(subtaskId, e) => handleTaskClickForDetail(subtaskId, e)}
    // MISSING: onSubtaskToggle
  />
  ```
- **Suggested Fix**:
  - Add `onSubtaskToggle?: (subtaskId: string) => void` prop to `DayColumnProps`
  - Pass it through to `ParentTaskCard`

### Issue 2: DayColumn - onSubtaskToggle not passed to ParentTaskCard (Legacy Mode)

- **Location**: DayColumn component, legacy mode rendering
- **File**: `apps/web/src/components/calendar/DayColumn.tsx`
- **Lines**: 611-622
- **What I See**: Same issue as Issue 1 - `ParentTaskCard` rendered without `onSubtaskToggle`
- **Expected**: Consistent behavior between unified and legacy modes
- **Code Analysis**:
  ```tsx
  // Current (line 611-622):
  <ParentTaskCard
    key={task.id}
    id={task.id}
    title={task.title}
    caseNumber={task.caseNumber}
    subtasks={task.subtasks}
    isTimeGridMode={false}
    onParentClick={(e) => handleTaskClickForDetail(task.id, e)}
    onSubtaskClick={(subtaskId, e) => handleTaskClickForDetail(subtaskId, e)}
    // MISSING: onSubtaskToggle
  />
  ```

### Issue 3: CalendarPage - No subtask completion handler exists

- **Location**: CalendarPage component
- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx`
- **Lines**: ~252-280 (handlers section)
- **What I See**: There are handlers for `handleTaskAddNote`, `handleTaskLogTime`, `handleTaskComplete`, but no handler for subtask completion. The `UPDATE_TASK` mutation is already imported (line 31).
- **Expected**: A `handleSubtaskToggle` handler should exist and be passed down through DayColumn
- **Suggested Fix**:
  - Create `handleSubtaskToggle` function similar to tasks page implementation
  - Wire it through DayColumn to ParentTaskCard

---

## Implementation Status

The `ParentTaskCard` component already has full support for `onSubtaskToggle`:
- Line 30: `onSubtaskToggle?: (subtaskId: string) => void` prop defined
- Lines 179-208: Checkbox is clickable when `onSubtaskToggle` is provided
- Hover styles and accessibility attributes are in place

The issue is purely a **wiring problem** - the prop exists but is never passed.

---

## Iteration Tasks

> These tasks fix the subtask completion in calendar view

### Task 1: Add onSubtaskToggle prop to DayColumnProps

- **File**: `apps/web/src/components/calendar/DayColumn.tsx` (MODIFY)
- **Do**:
  1. Add `onSubtaskToggle?: (subtaskId: string) => void` to `DayColumnProps` interface (around line 62)
  2. Destructure it in the component function (line 286)
- **Done when**: DayColumn accepts the onSubtaskToggle prop

### Task 2: Pass onSubtaskToggle to ParentTaskCard instances

- **File**: `apps/web/src/components/calendar/DayColumn.tsx` (MODIFY)
- **Do**:
  1. In unified calendar mode (line ~541), add: `onSubtaskToggle={onSubtaskToggle}`
  2. In legacy mode (line ~622), add: `onSubtaskToggle={onSubtaskToggle}`
- **Done when**: ParentTaskCard receives the toggle callback

### Task 3: Create handleSubtaskToggle in CalendarPage

- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Do**:
  1. Create `handleSubtaskToggle` callback using `updateTaskMutation`
  2. Toggle status between 'Completed' and 'InProgress'
  3. Call `refetchEvents()` on success
- **Done when**: Subtask status can be toggled via mutation

### Task 4: Wire handleSubtaskToggle through DayColumn

- **File**: `apps/web/src/app/(dashboard)/calendar/page.tsx` (MODIFY)
- **Do**:
  1. Pass `onSubtaskToggle={handleSubtaskToggle}` to DayColumn in week view (line ~836)
  2. Pass to DayView component if it also renders ParentTaskCard
- **Done when**: Clicking subtask checkbox in calendar updates the task status

---

## Backend Verification

The backend already supports subtask completion:
- `UPDATE_TASK` mutation accepts `status` field
- Status values: `Pending`, `InProgress`, `Completed`, `Cancelled`

No backend changes required.

---

## Verdict

- [x] **Issues found** - Fix the wiring in DayColumn and CalendarPage
- [ ] **No issues** - Implementation looks good! Proceed to `/commit`
