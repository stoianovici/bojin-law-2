# Brainstorm: Subtask System for Desktop Tasks View

**Status**: Complete
**Date**: 2025-01-02
**Next step**: `/research brainstorm-subtasks`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Zustand, Apollo Client (GraphQL), Radix UI
**Path**: Desktop tasks view at `src/app/(dashboard)/tasks/page.tsx`

**Current State**:

- Tasks have: title, description, status, priority, dueDate, estimatedDuration, assignee, case, type
- Subtasks are simple checkboxes: `{ id, title, completed }` (defined in `MockSubtask` interface)
- No parent-child relationships between full tasks
- Task form at `src/components/forms/TaskForm.tsx`
- Tasks store at `src/store/tasksStore.ts`

---

## Problem Statement

Users need to create and manage complex tasks that have subtasks. The current simple checkbox model doesn't support:

- Subtasks with their own assignees, due dates, estimates
- Progress tracking based on estimated time
- Subtasks appearing as standalone items in the task list

---

## Decisions

### 1. Subtask Model

**Choice**: Subtasks are full tasks with all fields (Asana-style)

- One level of nesting only (no sub-subtasks)
- Each subtask has: title, description, status, priority, dueDate, estimatedDuration, assignee, type
- Subtasks linked to parent via `parentTaskId` field

### 2. Creation Flow

**Choice**: Modal stack pattern

- User opens "Create Task" modal for parent
- "Add Subtask" button opens nested modal (slides in or overlays)
- Subtask modal has "Back to parent" navigation
- On save, returns to parent modal showing subtask in list
- User can add multiple subtasks before creating parent
- Final "Create Task" creates parent + all subtasks in one operation

### 3. Field Inheritance

**Choice**: Inherit Case only

- When opening subtask modal, Case field pre-fills from parent
- Assignee and Due Date start blank (subtasks often have different owners/deadlines)
- All inherited fields can be overridden

### 4. Progress Display

**Choice**: Progress bar based on estimated time

- Parent task shows: `████░░░░░░ 40%` (4h completed of 10h total)
- Calculation: sum of completed subtasks' estimated hours / sum of all subtasks' estimated hours
- If no estimates, fall back to count-based: completed subtasks / total subtasks

### 5. Status Independence

**Choice**: Fully independent with completion constraint

- Each subtask can have any status independently
- Parent status can be anything EXCEPT "Complete/Finalizat"
- Parent can only be marked complete when ALL subtasks are complete
- UI should show warning/block if user tries to complete parent with incomplete subtasks

### 6. List Display

**Choice**: Collapsible groups under parent

```
▼ ☐ │▌│ Prepare court filing        │ ████░░ 40% │ 15 Ian │
    ☐ │▌│ Draft motion              │ Maria      │ 10 Ian │
    ☐ │▌│ Review citations          │ Alex       │ 12 Ian │
► ☐ │▌│ Another parent task         │ ██████ 60% │ 20 Ian │
```

- Parent tasks show collapse/expand chevron
- Subtasks indented under parent
- Collapsed by default for completed parents
- Expand/collapse state persisted in store

### 7. Filter Behavior

**Choice**: Show matching subtasks AND their parent tasks

- When filtering (e.g., by assignee "Maria"), show:
  - Maria's own tasks
  - Maria's subtasks
  - Parent tasks of Maria's subtasks (for context, even if parent assigned to someone else)
- Parent shown in muted/context style if it doesn't match filter itself

---

## Rationale

| Decision                  | Why                                                                         |
| ------------------------- | --------------------------------------------------------------------------- |
| Asana model               | Closest to requirement of subtasks as standalone tasks with full fields     |
| Modal stack               | Prevents user from getting lost; maintains context of what they're building |
| Case inheritance only     | Case is almost always same; assignee/dates typically differ per subtask     |
| Time-based progress       | More accurate than count-based; reflects actual work remaining              |
| Independent status        | Allows parallel work; completion constraint prevents premature closure      |
| Collapsible groups        | Clean list view; easy to focus on specific parent or see all                |
| Parent context in filters | Critical for understanding subtask context; avoids orphaned items           |

---

## Open Questions for Research

- [ ] How to extend GraphQL schema for parent-child task relationships (check backend at `bojin-law-2`)
- [ ] Existing modal stack patterns in codebase (check Radix Dialog usage)
- [ ] Animation approach for modal transitions (Radix + Tailwind or Framer Motion)
- [ ] How to handle bulk creation (parent + subtasks) in single mutation
- [ ] Store changes needed for collapse state and parent-child relationships

---

## Next Step

Start a new session and run:

```
/research brainstorm-subtasks
```
