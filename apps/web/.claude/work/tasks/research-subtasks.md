# Research: Subtask System for Desktop Tasks View

**Status**: Complete
**Date**: 2025-01-02
**Input**: `brainstorm-subtasks.md`
**Next step**: `/plan research-subtasks`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Zustand, Apollo Client (GraphQL), Radix UI
**Path**: Desktop tasks view at `src/app/(dashboard)/tasks/page.tsx`
**Backend**: bojin-law-2 (separate repo, Prisma + GraphQL Gateway)

**Goal**: Implement full-featured subtasks (Asana-style) with:

- Subtasks as full tasks with all fields (title, status, priority, dueDate, estimatedDuration, assignee, type)
- One level of nesting only (no sub-subtasks)
- Modal stack pattern for creation flow
- Progress tracking based on estimated time
- Collapsible groups in list display

---

## Problem Statement

Users need to create and manage complex tasks that have subtasks. The current simple checkbox model (`{ id, title, completed }`) doesn't support subtasks with their own assignees, due dates, or estimates.

---

## Research Findings

### 1. Existing Code Analysis

#### Reusable Patterns

**Modal Stack Pattern (KEY FINDING)**:

- `src/components/documents/CreateMapaModal.tsx` demonstrates working nested modal pattern
- Uses `useState` for each modal level's open state
- Radix Dialog Portal handles z-index layering automatically
- Data flows via callback props (`onSelect`, `onSuccess`)

```tsx
// Parent manages nested modal state
const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

// Opens nested modal from parent
<Button onClick={() => setTemplatePickerOpen(true)}>Select Template</Button>

// Nested modal uses same Radix Dialog pattern
<TemplatePicker
  open={templatePickerOpen}
  onOpenChange={setTemplatePickerOpen}
  onSelect={handleTemplateSelect}
/>
```

**Expand/Collapse Pattern**:

- `TaskGroup` component (tasks/page.tsx:567-624) implements collapsible groups
- Uses `useState` with `ChevronDown`/`ChevronRight` icons
- Pattern can be directly applied to parent tasks with subtasks

```tsx
const [isExpanded, setIsExpanded] = useState(defaultExpanded);
{
  isExpanded ? <ChevronDown /> : <ChevronRight />;
}
{
  isExpanded && <div className="space-y-2">{children}</div>;
}
```

**Dialog Base Component** (`src/components/ui/Dialog.tsx`):

- Full Radix Dialog wrapper with size variants (sm, md, lg, xl, full)
- Supports `showCloseButton` prop
- Uses `z-linear-modal` for consistent layering
- Animations: fadeIn/scaleIn on open, fadeOut on close

#### Files Needing Modification

| File                                  | Action | Purpose                                           |
| ------------------------------------- | ------ | ------------------------------------------------- |
| `src/app/(dashboard)/tasks/page.tsx`  | Modify | Add parent-child rendering, expand/collapse state |
| `src/components/forms/TaskForm.tsx`   | Modify | Add subtask creation flow, parentTaskId field     |
| `src/components/tasks/TaskDrawer.tsx` | Modify | Update to full subtask display                    |
| `src/store/tasksStore.ts`             | Modify | Add expandedTaskIds state                         |
| `src/graphql/mutations.ts`            | Modify | Add UPDATE_TASK mutation                          |
| `src/graphql/queries.ts`              | Modify | Include subtasks in task queries                  |
| `src/hooks/mobile/useCreateTask.ts`   | Modify | Add parentTaskId to CreateTaskInput               |

#### Files to Create

| File                                    | Purpose                           |
| --------------------------------------- | --------------------------------- |
| `src/hooks/useUpdateTask.ts`            | Hook for UPDATE_TASK mutation     |
| `src/components/forms/SubtaskModal.tsx` | Nested modal for subtask creation |

### 2. Current Data Structures

**Current MockTask** (tasks/page.tsx:76-88):

```typescript
interface MockTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus; // 'planificat' | 'in_lucru' | 'review' | 'finalizat'
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  estimatedDuration?: string;
  assignee: MockAssignee;
  case?: MockCase;
  subtasks: MockSubtask[]; // Current: simple checkbox model
  activities: MockActivity[];
}

interface MockSubtask {
  id: string;
  title: string;
  completed: boolean;
}
```

**Required Change**: Subtasks become full Task objects with `parentTaskId` field.

### 3. Backend Support (CRITICAL FINDING)

The backend **already fully supports** parent-child task relationships:

**Prisma Schema** (bojin-law-2):

```prisma
model Task {
  id            String   @id @default(uuid())
  parentTaskId  String?  @map("parent_task_id")  // Already exists!

  // Self-referential relations
  parentTask    Task?    @relation("TaskSubtasks", fields: [parentTaskId], references: [id])
  subtasks      Task[]   @relation("TaskSubtasks")  // Child tasks

  // All standard fields available for subtasks
  title         String
  status        TaskStatus
  priority      TaskPriority
  dueDate       DateTime
  assignedTo    String
  estimatedHours Decimal?
  // ... other fields
}
```

**Backend Mutations Available**:

- `createTask` - Already supports `parentTaskId` input
- `updateTask` - Already implemented (frontend just needs to add mutation)
- `completeTask`, `cancelTask`, `deleteTask` - All available

**Frontend Gap**: Missing `UPDATE_TASK` mutation definition in frontend.

### 4. Animation Patterns

**Available Animations** (tailwind.config.js):

- `fadeIn`, `fadeOut` (200ms/150ms)
- `scaleIn` (200ms) - used for dialog content
- `slideInRight`, `slideOutRight` (300ms/200ms)
- `slideInUp`, `slideOutDown` (300ms/200ms) - used for BottomSheet

**Recommended for Modal Stack**:

- Level 1 (Parent task modal): `scaleIn` (current Dialog default)
- Level 2 (Subtask modal): `slideInRight` (slide in from right)

**No additional animation libraries needed** - Tailwind + Radix is sufficient.

### 5. UI Store Structure

**Current tasksStore.ts**:

- Manages view preferences only (viewMode, groupBy, filters)
- Does NOT store actual task data (comes from GraphQL/mock)
- Uses localStorage for persistence

**Needed Addition**:

```typescript
interface TasksState {
  // Existing...
  expandedTaskIds: Set<string>; // Track which parent tasks are expanded

  // New actions
  toggleTaskExpanded: (taskId: string) => void;
  setTaskExpanded: (taskId: string, expanded: boolean) => void;
}
```

### 6. Task List Rendering

**Current Structure** (tasks/page.tsx):

```
TasksPage
├── TaskGroup (groupBy: status/priority/assignee/dueDate)
│   └── TaskRow[] (flat list of tasks)
```

**Required Structure**:

```
TasksPage
├── TaskGroup (groupBy: status/priority/assignee/dueDate)
│   └── ParentTaskRow (expandable, shows progress bar)
│       └── SubtaskRow[] (indented, full task display)
│   └── StandaloneTaskRow (no subtasks)
```

**Key Modifications**:

1. Detect parent tasks (has subtasks array or is root task)
2. Add expand/collapse toggle to parent tasks
3. Conditionally render subtask rows with indentation
4. Calculate and display progress bar on parent tasks

---

## Implementation Recommendation

### Phase 1: Data Layer (Backend Integration)

1. **Add UPDATE_TASK mutation** to frontend:

   ```graphql
   mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
     updateTask(id: $id, input: $input) {
       id
       title
       status
       parentTaskId
       subtasks {
         id
         title
         status
         priority
         dueDate
         assignee {
           id
           name
         }
       }
     }
   }
   ```

2. **Update task queries** to include `subtasks` and `parentTaskId` fields

3. **Create useUpdateTask hook** for task modifications

### Phase 2: Modal Stack for Subtask Creation

1. **Create SubtaskModal component**:
   - Reuses TaskForm with pre-filled `parentTaskId` and Case from parent
   - Opens as nested modal from parent task modal
   - Returns created subtask to parent for display

2. **Modify TaskForm**:
   - Add "Add Subtask" button when editing existing task
   - Track pending subtasks before final save
   - Batch create parent + subtasks in single operation

### Phase 3: List Display with Collapsible Groups

1. **Extend tasksStore** with `expandedTaskIds` state

2. **Modify TaskRow component**:
   - Accept `isSubtask` and `indentLevel` props
   - Show expand/collapse chevron for parent tasks
   - Show progress bar instead of single status for parent tasks

3. **Update rendering logic**:
   - Group subtasks under parent tasks
   - Apply filters to both parent and subtasks
   - Show parent context when subtask matches filter

### Phase 4: Progress Calculation

1. **Implement progress utility**:

   ```typescript
   function calculateProgress(subtasks: Task[]): {
     completed: number;
     total: number;
     percentage: number;
     isTimeBased: boolean;
   };
   ```

2. **Time-based when estimates exist**, count-based otherwise

---

## File Plan

| File                                    | Action | Purpose                               |
| --------------------------------------- | ------ | ------------------------------------- |
| `src/graphql/mutations.ts`              | Modify | Add UPDATE_TASK mutation              |
| `src/graphql/queries.ts`                | Modify | Add subtasks field to task queries    |
| `src/hooks/useUpdateTask.ts`            | Create | Hook for updating tasks               |
| `src/store/tasksStore.ts`               | Modify | Add expandedTaskIds state             |
| `src/components/forms/SubtaskModal.tsx` | Create | Nested modal for subtask creation     |
| `src/components/forms/TaskForm.tsx`     | Modify | Add subtask creation flow             |
| `src/app/(dashboard)/tasks/page.tsx`    | Modify | Parent-child rendering, progress bars |
| `src/components/tasks/TaskDrawer.tsx`   | Modify | Update subtask section display        |
| `tailwind.config.js`                    | Modify | Add slideInLeft animation if needed   |

---

## Risks

| Risk                          | Mitigation                                                         |
| ----------------------------- | ------------------------------------------------------------------ |
| Backend schema changes needed | Verified: Backend already supports parent-child via `parentTaskId` |
| Modal z-index conflicts       | Radix Dialog Portal handles layering automatically                 |
| Performance with deep nesting | Limited to 1 level of nesting (no sub-subtasks)                    |
| Filter complexity             | Show parent context when subtask matches filter                    |
| Bulk creation failure         | Use transaction or queue operations with rollback                  |

---

## Constraints Found

1. **One level of nesting only** - Prisma schema supports it, but UI should enforce
2. **Status constraint** - Parent cannot be "Finalizat" unless all subtasks complete
3. **Case inheritance** - Subtasks must belong to same case as parent
4. **No animation library** - Must use Tailwind CSS animations only

---

## Patterns Discovered

1. **Modal state management**: Simple `useState` at parent level, no context needed
2. **Expand/collapse**: Local `useState` with chevron icons (TaskGroup pattern)
3. **Data flow**: Callback props for child-to-parent communication
4. **Animations**: Radix `data-[state]` attributes + Tailwind keyframes
5. **Store pattern**: Zustand with localStorage persistence for UI state only

---

## Next Step

Start a new session and run:

```
/plan research-subtasks
```
