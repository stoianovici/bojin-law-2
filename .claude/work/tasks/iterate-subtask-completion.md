# Iteration: Subtask Completion Functionality

**Status**: Review Complete
**Date**: 2026-01-06
**Input**: User feedback - "currently the user can't finalize, or even mark done, a subtask"
**Screenshots**: `.playwright-mcp/iterate-subtask-*.png`
**Next step**: Fix issues via `/implement iterate-subtask-completion`

---

## Inspection Summary

### Components Inspected

| Component         | File                                                  | Issues |
| ----------------- | ----------------------------------------------------- | ------ |
| TaskDrawer        | `apps/web/src/components/tasks/TaskDrawer.tsx`        | 2      |
| ParentTaskCard    | `apps/web/src/components/calendar/ParentTaskCard.tsx` | 1      |
| TasksPage         | `apps/web/src/app/(dashboard)/tasks/page.tsx`         | 1      |

---

## Issues Found

### Issue 1: TaskDrawer - Full subtasks have no completion toggle

- **Location**: TaskDrawer component, fullSubtasks rendering section
- **File**: `apps/web/src/components/tasks/TaskDrawer.tsx`
- **Lines**: ~351-426
- **What I See**: Full subtask cards display status badge and checkbox indicator, but clicking the card only triggers `onSubtaskClick` (navigation). There's no way to mark the subtask as complete.
- **Expected**: User should be able to click a checkbox or button to toggle subtask completion status
- **Suggested Fix**:
  - Add an `onSubtaskComplete` callback prop
  - Add a clickable checkbox that calls `onSubtaskComplete(subtaskId)`
  - Prevent event propagation so clicking checkbox doesn't also navigate

### Issue 2: TaskDrawer - Legacy simple subtasks only log to console

- **Location**: TaskDrawer callbacks in tasks page
- **File**: `apps/web/src/app/(dashboard)/tasks/page.tsx`
- **Lines**: ~1399-1401
- **What I See**: `onSubtaskToggle` is wired up but only logs to console: `console.log('Toggle subtask:', subtaskId, completed)`
- **Expected**: Should call UPDATE_TASK mutation to change subtask status to "Completed" or "InProgress"
- **Suggested Fix**:
  - Create `handleSubtaskToggle` function that calls `updateTask` mutation
  - Update subtask status to "Completed" when toggling on, "InProgress" when toggling off

### Issue 3: ParentTaskCard - Checkbox is visual-only indicator

- **Location**: ParentTaskCard component, subtask checkbox
- **File**: `apps/web/src/components/calendar/ParentTaskCard.tsx`
- **Lines**: ~176-185
- **What I See**: Checkbox div shows completion state visually but has no click handler. The entire row clicks to `onSubtaskClick` which opens details, not toggle completion.
- **Expected**: Clicking the checkbox should toggle completion without navigating away
- **Suggested Fix**:
  - Add `onSubtaskToggle?: (subtaskId: string) => void` prop
  - Add `onClick` handler to checkbox div with `e.stopPropagation()`
  - Call `onSubtaskToggle(subtask.id)` when checkbox clicked

### Issue 4: No useUpdateTask hook integration for subtasks

- **Location**: Tasks page
- **File**: `apps/web/src/app/(dashboard)/tasks/page.tsx`
- **What I See**: Page has `completedTasks` local state for visual-only completion that resets on refresh. No actual API integration.
- **Expected**: Subtask completion should persist to database via GraphQL mutation
- **Suggested Fix**:
  - Import and use `useUpdateTask` hook
  - Call mutation with `{ id: subtaskId, status: 'Completed' }` or `{ id: subtaskId, status: 'InProgress' }`
  - Refetch tasks query after successful mutation

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-subtask-completion` for automated fixes

### Task 1: Add subtask completion callback to TaskDrawer

- **File**: `apps/web/src/components/tasks/TaskDrawer.tsx` (MODIFY)
- **Do**:
  1. Add `onSubtaskComplete?: (subtaskId: string) => void` to `TaskDrawerProps`
  2. In fullSubtasks map, wrap checkbox indicator in clickable button
  3. Add click handler that calls `onSubtaskComplete(subtask.id)` with `e.stopPropagation()`
- **Done when**: Clicking checkbox in TaskDrawer calls the completion callback

### Task 2: Add subtask toggle to ParentTaskCard

- **File**: `apps/web/src/components/calendar/ParentTaskCard.tsx` (MODIFY)
- **Do**:
  1. Add `onSubtaskToggle?: (subtaskId: string) => void` to `ParentTaskCardProps`
  2. Make checkbox div clickable with `e.stopPropagation()`
  3. Call `onSubtaskToggle(subtask.id)` on checkbox click
- **Done when**: Clicking checkbox in ParentTaskCard calls toggle callback without navigating

### Task 3: Wire up subtask completion mutation in TasksPage

- **File**: `apps/web/src/app/(dashboard)/tasks/page.tsx` (MODIFY)
- **Do**:
  1. Import `useUpdateTask` hook (or use Apollo's `useMutation` with `UPDATE_TASK`)
  2. Create `handleSubtaskComplete` function that:
     - Calls mutation with `{ id: subtaskId, status: 'Completed' }`
     - Refetches tasks query on success
  3. Pass `handleSubtaskComplete` to TaskDrawer's `onSubtaskComplete` prop
  4. Update `handleToggleComplete` to work for subtasks too
- **Done when**: Marking subtask complete persists to database

### Task 4: Add optimistic UI update for subtask completion

- **File**: `apps/web/src/app/(dashboard)/tasks/page.tsx` (MODIFY)
- **Do**:
  1. Add optimistic response to mutation for instant feedback
  2. Update Apollo cache directly or use refetchQueries
- **Done when**: UI updates immediately when marking subtask complete

---

## Backend Verification

The backend already supports subtask completion:
- `UPDATE_TASK` mutation accepts `status` field
- `SubtaskService.completeSubtask()` handles history, notifications, and activity feed
- Status values: `Pending`, `InProgress`, `Completed`, `Cancelled`

No backend changes required.

---

## Verdict

- [x] **Issues found** - Run `/implement iterate-subtask-completion` to fix, or make manual changes
- [ ] **No issues** - Implementation looks good! Proceed to `/commit`
