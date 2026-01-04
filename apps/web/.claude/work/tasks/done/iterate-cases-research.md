# Iteration: Cases Page Enhancement (based on Tasks page patterns)

**Status**: Review Complete
**Date**: 2024-12-29
**Input**: Code analysis of `/tasks` vs `/cases` pages
**Screenshots**: `.claude/work/screenshots/iterate-cases-research/` (auth required)
**Next step**: `/implement iterate-cases-research` to apply improvements

---

## Analysis Summary

### Tasks Page Features (Reference Implementation)

The `/tasks` page (`src/app/(dashboard)/tasks/page.tsx`) implements a mature Linear-style interface with:

| Feature              | Implementation                                                                      |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Layout**           | Full-height flex with header, main content, and side panel                          |
| **Header**           | Sticky with title, view toggle (list/kanban/calendar), and CTA button               |
| **Filters**          | Search input, toggle buttons (My Tasks, Filters, Case, Due Date), grouping dropdown |
| **List View**        | Grouped rows with collapsible sections, priority indicators, status badges          |
| **Side Panel**       | 380px wide drawer for task details OR team activity feed                            |
| **State Management** | Zustand store (`tasksStore.ts`) with persisted preferences                          |
| **Components**       | Dedicated components (`TaskDrawer`, `TeamActivityFeed`)                             |

### Cases Page Current State

The `/cases` page (`src/app/(dashboard)/cases/page.tsx`) has a simpler implementation:

| Feature              | Current State                                   |
| -------------------- | ----------------------------------------------- |
| **Layout**           | Basic `p-6 space-y-6` padding, no side panel    |
| **Header**           | Simple h1/p with Button, no view toggle         |
| **Filters**          | Basic tabs (Active/Archived/All) + search input |
| **List View**        | Card grid layout (3 columns), no grouping       |
| **Side Panel**       | None                                            |
| **State Management** | None - relies on GraphQL queries only           |
| **Components**       | Inline `CaseCard`, `CaseList` components        |

---

## Proposed Improvements

### 1. Enhanced Layout Structure

**Current**: Simple padding-based layout
**Target**: Match Tasks page layout with:

- Full-height flex container
- Sticky header with bg-linear-bg-secondary
- Scrollable main content area with side panel

### 2. Add View Toggle

**Current**: Only card grid view
**Target**: Support multiple views:

- Card grid (current - default)
- List view (like Tasks)
- Table view (for dense data)

### 3. Enhanced Filtering System

**Current**: Only tabs for status + basic search
**Target**: Rich filter toolbar:

- Search input with icon
- Toggle filter buttons (My Cases, Type, Client, Team Member)
- Grouping dropdown (by status, type, client, team lead)
- Clear filters action

### 4. Side Panel with Case Details

**Current**: None - clicking card navigates to detail page
**Target**: Split view with:

- Main area: Case list (width: flex-1)
- Side panel (380px): Case details drawer or Recent Activity feed

### 5. State Management Store

**Current**: None
**Target**: Create `casesStore.ts` with:

- View preference (grid/list/table)
- Grouping preference
- Selected filters (status, type, client)
- Selected case ID (for drawer)
- Search query

### 6. Dedicated Components

**Current**: Inline components
**Target**: Extract to `src/components/cases/`:

- `CaseCard.tsx` - Grid card view
- `CaseRow.tsx` - List row view
- `CaseDrawer.tsx` - Side panel details
- `CaseActivityFeed.tsx` - Recent activity on cases

### 7. List Row View (matching Tasks)

**Target**: Create `CaseRow` component with:

- Status indicator (colored dot)
- Case number (monospace font)
- Title (primary text)
- Client name (secondary)
- Team lead avatar
- Status badge
- Opened date

---

## Files to Create/Modify

| File                                        | Action | Description                          |
| ------------------------------------------- | ------ | ------------------------------------ |
| `src/store/casesStore.ts`                   | CREATE | Zustand store for cases view state   |
| `src/components/cases/CaseCard.tsx`         | CREATE | Extract & enhance card component     |
| `src/components/cases/CaseRow.tsx`          | CREATE | List row view component              |
| `src/components/cases/CaseDrawer.tsx`       | CREATE | Side panel details (like TaskDrawer) |
| `src/components/cases/CaseActivityFeed.tsx` | CREATE | Recent activity feed                 |
| `src/components/cases/index.ts`             | CREATE | Component exports                    |
| `src/app/(dashboard)/cases/page.tsx`        | MODIFY | Implement new layout & features      |
| `src/graphql/queries.ts`                    | MODIFY | Add case activities query if needed  |

---

## Implementation Tasks

> These tasks can be passed to `/implement iterate-cases-research` for execution

### Task 1: Create Cases Store

- **File**: `src/store/casesStore.ts` (CREATE)
- **Do**: Create Zustand store following `tasksStore.ts` pattern with:
  - `viewMode`: 'grid' | 'list' | 'table'
  - `groupBy`: 'status' | 'type' | 'client' | 'teamLead' | 'none'
  - `searchQuery`: string
  - `selectedCaseId`: string | null
  - `selectedFilters`: { status: string[], type: string[], clientId: string[] }
- **Done when**: Store works with persisted preferences

### Task 2: Extract CaseCard Component

- **File**: `src/components/cases/CaseCard.tsx` (CREATE)
- **Do**: Move `CaseCard` from page to dedicated file, enhance with:
  - Hover state matching Tasks design
  - Click handler for selecting (not just navigation)
  - Priority/urgency indicator based on age
- **Done when**: Card renders same as before, click selects case

### Task 3: Create CaseRow Component

- **File**: `src/components/cases/CaseRow.tsx` (CREATE)
- **Do**: Create list row view matching TaskRow pattern:
  - Status dot (colored by status)
  - Case number (monospace, 11px)
  - Title (13px, primary text)
  - Client name (secondary)
  - Team lead avatar
  - Status badge (using Badge component)
  - Opened date (with Calendar icon)
- **Done when**: Row renders case data in horizontal layout

### Task 4: Create CaseDrawer Component

- **File**: `src/components/cases/CaseDrawer.tsx` (CREATE)
- **Do**: Create side panel component following TaskDrawer pattern:
  - Header with action buttons (Edit, Archive, More)
  - Case title section
  - Properties section (Status, Type, Client, Team, Dates)
  - Quick actions
  - Activity/history section
- **Done when**: Drawer shows full case details in panel format

### Task 5: Update Cases Page Layout

- **File**: `src/app/(dashboard)/cases/page.tsx` (MODIFY)
- **Do**: Refactor page to match Tasks layout:
  - Full-height flex container
  - Sticky header with bg-linear-bg-secondary
  - View toggle (grid/list)
  - Enhanced filter toolbar
  - Main content + side panel layout
  - Integrate casesStore
  - Support drawer selection
- **Done when**: Page has same structure as Tasks, with grid/list views

### Task 6: Create Component Index

- **File**: `src/components/cases/index.ts` (CREATE)
- **Do**: Export all case components
- **Done when**: Components importable from `@/components/cases`

---

## Design System Compliance Checklist

- [ ] Use `bg-linear-bg-secondary` for header
- [ ] Use `border-linear-border-subtle` for borders
- [ ] Use `text-[13px]` for body text, `text-[11px]` for meta
- [ ] Use Badge component for status indicators
- [ ] Use Avatar component for team members
- [ ] Use 380px width for side panel
- [ ] Use `space-y-2` for row gaps in list view
- [ ] Use ScrollArea for scrollable content

---

## Verdict

- [x] **Improvements identified** - Run `/implement iterate-cases-research` to build the enhanced Cases page following Tasks patterns
- [ ] **No changes needed** - N/A

---

## Reference: Key Code Patterns from Tasks

### Layout Structure

```tsx
<div className="flex h-full flex-col">
  {/* Header */}
  <header className="bg-linear-bg-secondary border-b border-linear-border-subtle px-6 py-4">
    ...
  </header>

  {/* Main Container */}
  <div className="flex flex-1 overflow-hidden">
    {/* Content Panel */}
    <ScrollArea className="flex-1 p-6">...</ScrollArea>

    {/* Side Panel */}
    <aside className="w-[380px] bg-linear-bg-secondary border-l border-linear-border-subtle">
      ...
    </aside>
  </div>
</div>
```

### Filter Button Pattern

```tsx
<button
  className={cn(
    'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
    isActive
      ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'
      : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:bg-linear-bg-hover'
  )}
>
  <Icon className="h-3.5 w-3.5" />
  Label
</button>
```

### Row Pattern

```tsx
<div
  className={cn(
    'flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all',
    'bg-linear-bg-secondary border border-linear-border-subtle',
    'hover:border-linear-border-default hover:shadow-sm',
    isSelected && 'border-linear-accent bg-linear-bg-tertiary'
  )}
>
  {/* Content */}
</div>
```
