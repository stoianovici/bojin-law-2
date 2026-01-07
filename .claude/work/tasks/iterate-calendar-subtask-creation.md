# Iteration: Calendar Task Modal - Subtask Creation

**Status**: Implementation Complete
**Date**: 2026-01-06
**Input**: User request - "in calendar view - new task modal should allow for subtask creation"
**Screenshots**: `.playwright-mcp/calendar-task-modal.png`
**Next step**: Test manually and commit

---

## Inspection Summary

### Pages Inspected

| Route     | Screenshot              | Issues |
| --------- | ----------------------- | ------ |
| /calendar | calendar-task-modal.png | 1      |

### Components Inspected

| Component | Screenshot              | Issues |
| --------- | ----------------------- | ------ |
| TaskForm  | calendar-task-modal.png | 1      |

---

## Current State Analysis

The current `TaskForm` component (`apps/web/src/components/forms/TaskForm.tsx`) already has subtask functionality but it's **only shown when editing an existing task**:

```tsx
// Line 129
const showAddSubtaskButton = isEditingTask && !isCreatingSubtask;
```

This means:
- When creating a NEW task from the calendar → No subtask button shown
- When editing an EXISTING task → Subtask button is shown (if not already creating a subtask)

### Screenshot Analysis

The calendar task modal shows:
- All standard task fields (Title, Case, Assignee, Due Date, Duration, Type, Priority, Description)
- **No "Add Subtask" button visible** - because this is a new task creation flow

---

## Issues Found

### Issue 1: No Subtask Creation for New Tasks

- **Location**: Calendar page → New Task modal
- **Screenshot**: `calendar-task-modal.png`
- **What I See**: The "Adaugă subsarcină" (Add subtask) button is not visible when creating a new task
- **Expected**: User should be able to add subtasks while creating a new task
- **Root Cause**: `showAddSubtaskButton` condition in `TaskForm.tsx:129` requires `editingTaskId` to be set

---

## Design Considerations

### Option A: Allow Subtask Creation for New Tasks (Pending Subtasks)
- Add subtasks inline that will be created **after** the parent task is created
- Store subtasks temporarily in `pendingSubtasks` state
- On form submit: Create parent task first, then create all pending subtasks with the parent task ID
- **Pros**: Seamless UX, create everything at once
- **Cons**: More complex logic, need to handle batch creation

### Option B: Two-Step Flow
- Create the parent task first
- Then open the task for editing where subtasks can be added
- **Pros**: Simpler implementation
- **Cons**: More steps for user, less convenient

### Recommended: Option A
The `pendingSubtasks` state already exists in `TaskForm.tsx`. We just need to:
1. Enable the "Add Subtask" button for new task creation
2. Update the submit handler to create subtasks after parent task creation
3. Update the backend mutation to support creating subtasks

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-calendar-subtask-creation` for automated fixes

### Task 1: Enable Add Subtask Button for New Task Creation

- **File**: apps/web/src/components/forms/TaskForm.tsx (MODIFY)
- **Do**: Change the condition for `showAddSubtaskButton` to also allow it during new task creation when a case is selected
- **Line**: ~129
- **Change**:
  ```tsx
  // From:
  const showAddSubtaskButton = isEditingTask && !isCreatingSubtask;

  // To:
  const showAddSubtaskButton = !isCreatingSubtask && (isEditingTask || selectedCase !== null);
  ```
- **Done when**: "Adaugă subsarcină" button appears when creating a new task (after case is selected)

### Task 2: Create Simplified Subtask Input Component

- **File**: apps/web/src/components/forms/TaskForm.tsx (MODIFY)
- **Do**: Add inline subtask input UI that doesn't require a modal (for new task creation flow)
- **Done when**: User can add subtasks inline with just title and optional assignee

### Task 3: Update Submit Handler to Create Subtasks

- **File**: apps/web/src/components/forms/TaskForm.tsx (MODIFY)
- **Do**: After creating the parent task, iterate through `pendingSubtasks` and create each one with the new parent task ID
- **Done when**: Subtasks are created as children of the newly created task

### Task 4: Update GraphQL Mutation (if needed)

- **File**: services/gateway/src/graphql/schema/task.graphql (MODIFY)
- **File**: services/gateway/src/graphql/resolvers/task.resolvers.ts (MODIFY)
- **Do**: Add `parentTaskId` to the task creation input if not already present
- **Done when**: Tasks can be created with a parent relationship

---

## Verdict

- [x] **Issues found** - The "Add Subtask" functionality exists but is hidden during new task creation
- [ ] **No issues** - N/A

**Recommendation**: This is a feature enhancement rather than a bug fix. The implementation requires:
1. UI changes to show the subtask button
2. State management for pending subtasks
3. Backend support for parent-child task relationship

Run `/implement iterate-calendar-subtask-creation` to implement, or clarify requirements first.

---

## Implementation Summary

### Changes Made

#### 1. `apps/web/src/components/forms/TaskForm.tsx`

**Line 129-130**: Changed `showAddSubtaskButton` condition
```tsx
// Before:
const showAddSubtaskButton = isEditingTask && !isCreatingSubtask;

// After:
const showAddSubtaskButton = !isCreatingSubtask && (isEditingTask || selectedCase !== null);
```

**Line 117**: Added state for inline subtask input
```tsx
const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
```

**Lines 145-159**: Added `addPendingSubtask` helper function
- Creates a pending subtask with title, priority (inherited from parent), duration (default 1h), and assignee (inherited from parent)

**Lines 207-228**: Updated submit handler to create subtasks
- After parent task is created, iterates through `pendingSubtasks` and creates each one with `parentTaskId`

**Lines 401-471**: Updated UI to show inline subtask input
- Shows "Subsarcini" section when a case is selected
- For new tasks: inline input field with Enter key and + button support
- For editing tasks: keeps the modal approach
- Shows list of pending subtasks with remove button

### How It Works

1. User opens task modal from calendar (press T or click time slot)
2. User selects a case → "Subsarcini" section appears
3. User types subtask title and presses Enter or clicks +
4. Subtask is added to "Subsarcini de creat" list
5. User can add multiple subtasks and remove them with X button
6. On form submit:
   - Parent task is created first
   - Each pending subtask is created with `parentTaskId` pointing to the new parent task

### Backend Support

The backend already supports `parentTaskId` in `CreateTaskInput` (task.graphql:136), so no backend changes were needed.
