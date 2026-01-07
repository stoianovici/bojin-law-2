# Plan: Subtask System for Desktop Tasks View

**Status**: Approved
**Date**: 2025-01-02
**Input**: `research-subtasks.md`
**Next step**: `/implement plan-subtasks`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Zustand, Apollo Client (GraphQL), Radix UI
**Path**: Desktop tasks view at `src/app/(dashboard)/tasks/page.tsx`
**Backend**: bojin-law-2 (separate repo) - Already supports `parentTaskId` for parent-child task relationships

## Approach Summary

Implement Asana-style subtasks where subtasks are full Task objects (with title, status, priority, dueDate, estimatedDuration, assignee, type) linked via `parentTaskId`. One level of nesting only. Uses modal stack pattern for creation flow (parent modal → nested subtask modal). Progress tracking based on estimated time when available. Collapsible groups in list display with expand/collapse state persisted in Zustand store.

---

## Parallel Group 1: Data Layer Foundation

> These tasks run simultaneously via sub-agents. No file conflicts.

### Task 1.1: Add UPDATE_TASK Mutation

- **File**: `src/graphql/mutations.ts` (MODIFY)
- **Do**: Add `UPDATE_TASK` mutation definition:
  ```graphql
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      description
      status
      priority
      dueDate
      estimatedDuration
      parentTaskId
      assignee {
        id
        name
        avatar
      }
      case {
        id
        title
      }
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedDuration
        assignee {
          id
          name
          avatar
        }
      }
    }
  }
  ```
- **Done when**: Mutation is exported and TypeScript compiles without errors

### Task 1.2: Update Task Queries with Subtasks Field

- **File**: `src/graphql/queries.ts` (MODIFY)
- **Do**: Update `GET_TASKS` and `GET_TASK` queries to include:
  - `parentTaskId` field on Task
  - `subtasks` relation with fields: `id, title, status, priority, dueDate, estimatedDuration, assignee { id name avatar }`
- **Done when**: Queries include subtasks field and TypeScript compiles

### Task 1.3: Create useUpdateTask Hook

- **File**: `src/hooks/useUpdateTask.ts` (CREATE)
- **Do**: Create hook following existing pattern from `src/hooks/mobile/useCreateTask.ts`:
  - Import `UPDATE_TASK` mutation
  - Return `{ updateTask, loading, error }`
  - Handle optimistic updates for task cache
  - Accept `UpdateTaskInput` with all editable fields including `parentTaskId`
- **Done when**: Hook exports correctly, follows project patterns, TypeScript compiles

### Task 1.4: Add expandedTaskIds to Tasks Store

- **File**: `src/store/tasksStore.ts` (MODIFY)
- **Do**:
  - Add `expandedTaskIds: Set<string>` to state (default: empty Set)
  - Add `toggleTaskExpanded(taskId: string)` action
  - Add `setTaskExpanded(taskId: string, expanded: boolean)` action
  - Persist to localStorage like existing preferences
- **Done when**: Store exports new state and actions, TypeScript compiles

---

## Sequential: After Group 1

### Task 2: Create SubtaskModal Component

- **Depends on**: Task 1.1, 1.2, 1.3 (needs UPDATE_TASK mutation and updated types)
- **File**: `src/components/forms/SubtaskModal.tsx` (CREATE)
- **Do**:
  - Create modal component using Radix Dialog (same pattern as `CreateMapaModal.tsx`)
  - Props: `open`, `onOpenChange`, `parentTask`, `onSuccess`
  - Reuse TaskForm internally with pre-filled: `parentTaskId`, `case` (inherited from parent)
  - Animation: Use `slideInRight` for nested modal feel (Tailwind animation exists)
  - On save: Call createTask mutation with `parentTaskId` set
  - Enforce: Cannot create sub-subtasks (disable "Add Subtask" button in this modal)
- **Done when**: Modal opens/closes correctly, creates subtask linked to parent, inherits case from parent

---

## Parallel Group 2: UI Integration

> These tasks run simultaneously via sub-agents. Different files, no conflicts.

### Task 3.1: Modify TaskForm with Subtask Creation Flow

- **File**: `src/components/forms/TaskForm.tsx` (MODIFY)
- **Do**:
  - Add "Add Subtask" button (only visible when editing existing task, not when `parentTaskId` is set)
  - Add state: `subtaskModalOpen`, `pendingSubtasks[]`
  - Open SubtaskModal on button click
  - Display pending subtasks list below form (before save)
  - On form submit: Create parent task first, then batch create subtasks with `parentTaskId`
  - Hide "Add Subtask" when form is for a subtask (has `parentTaskId`)
- **Done when**: Can add multiple subtasks during task creation, subtasks created correctly on save

### Task 3.2: Update Task List Rendering with Parent-Child Display

- **File**: `src/app/(dashboard)/tasks/page.tsx` (MODIFY)
- **Do**:
  - Modify TaskRow to accept `isSubtask?: boolean` and `indentLevel?: number` props
  - Add expand/collapse chevron for tasks with subtasks (use existing TaskGroup pattern)
  - When expanded: Render subtask rows with `ml-8` indentation
  - Add progress bar to parent tasks showing: `completed/total` subtasks (time-based if estimates exist)
  - Use `expandedTaskIds` from tasksStore for expand state
  - Filter logic: When subtask matches filter, show parent context
  - Update mock data to include nested subtask examples for testing
- **Done when**: Parent tasks show expand/collapse, subtasks render indented, progress bar displays correctly

---

## Sequential: Final Integration

### Task 4: Update TaskDrawer + Integration Testing

- **Depends on**: Task 3.1, 3.2
- **File**: `src/components/tasks/TaskDrawer.tsx` (MODIFY)
- **Do**:
  - Replace simple checkbox subtask display with full subtask cards
  - Each subtask card shows: title, status badge, priority, due date, assignee avatar
  - Add "Add Subtask" button that opens SubtaskModal
  - Clicking subtask opens its own TaskDrawer (or inline expansion)
  - Progress bar at top showing subtask completion
- **Integration Testing**:
  - Verify: Create task with subtasks → appears correctly in list
  - Verify: Expand/collapse persists via store
  - Verify: Progress calculation works (count-based and time-based)
  - Verify: Subtask inherits case from parent
  - Verify: Cannot create sub-subtask (button hidden/disabled)
  - Run `npm run type-check` and `npm run lint`
- **Done when**: Full flow works end-to-end, no TypeScript/lint errors

---

## Session Scope Assessment

- **Total tasks**: 8 (4 parallel + 1 sequential + 2 parallel + 1 sequential)
- **Estimated complexity**: Medium-Complex
- **Checkpoint recommended at**: After Task 3.2 (before final TaskDrawer integration)

## Key Patterns to Follow

1. **Modal Stack**: Use `useState` at parent level, Radix Dialog Portal handles z-index
2. **Expand/Collapse**: Local state + store persistence, ChevronDown/ChevronRight icons
3. **Data Flow**: Callback props (`onSuccess`, `onSelect`) for child-to-parent communication
4. **Animations**: `data-[state]` attributes + Tailwind keyframes (no external libraries)
5. **Store**: Zustand with localStorage persistence for UI state

## Constraints

1. **One level nesting only** - UI must prevent sub-subtask creation
2. **Case inheritance** - Subtasks auto-inherit case from parent
3. **Status rule** - Parent cannot be "Finalizat" if subtasks incomplete (enforce in UI)

---

## Next Step

Start a new session and run:

```
/implement plan-subtasks
```
