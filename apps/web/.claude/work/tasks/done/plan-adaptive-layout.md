# Plan: Adaptive Layout System

**Status**: Approved
**Date**: 2025-12-31
**Input**: `research-adaptive-layout.md`
**Next step**: `/implement plan-adaptive-layout`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Radix UI
**Design system**: Linear-inspired dark theme

**Key patterns**:

- Selection state via Zustand stores (not URL params)
- Animations via Tailwind keyframes (no Framer Motion)
- Panel structure: header with border → ScrollArea content
- Right panels currently 380px; mockup uses 400px for case list

## Approach Summary

We're implementing two features: (1) A contextual panel system that shows a 320px right panel with activity feed when the sidebar collapses, and (2) A Superhuman-style cases page with 400px master list + flexible detail panel. The cases page will have keyboard navigation (J/K/Enter/N) matching the mockup at `mockups/03-cases-superhuman.html`.

---

## Parallel Group 1: Foundation

> These 4 tasks run simultaneously via sub-agents. No file conflicts.

### Task 1.1: Add Context Panel State to uiStore

- **File**: `src/store/uiStore.ts` (MODIFY)
- **Do**:
  1. Add `contextPanelVisible: boolean` to UIState interface (default: `true`)
  2. Add `setContextPanelVisible: (visible: boolean) => void` action
  3. Add `contextPanelVisible` to the `partialize` persist config
- **Done when**: State can be toggled and persists across page reloads

### Task 1.2: Create Keyboard Navigation Hook

- **File**: `src/hooks/useCaseKeyboardNav.ts` (CREATE)
- **Do**:
  1. Create hook that accepts `{ cases, selectedCaseId, selectCase, onNewCase }`
  2. Handle keys: `j` (next), `k` (prev), `Enter` (focus detail), `n` (new case)
  3. Skip handling when focus is in input/textarea (check `document.activeElement`)
  4. Follow pattern from `src/hooks/useCommandPalette.ts`
- **Done when**: Hook exports and handles all 4 keyboard shortcuts

### Task 1.3: Create ContextPanel Component

- **File**: `src/components/layout/ContextPanel.tsx` (CREATE)
- **Do**:
  1. Create panel with header (title "Activity", close button)
  2. Import and render `TeamActivityFeed` from `src/components/tasks/TeamActivityFeed.tsx`
  3. Use panel pattern: `flex flex-col h-full`, header with `border-b border-linear-border-subtle`
  4. Close button calls `setContextPanelVisible(false)` from uiStore
  5. Style: `bg-linear-bg-secondary`
- **Done when**: Component renders activity feed with working close button

### Task 1.4: Create KeyboardHintsFooter Component

- **File**: `src/components/cases/KeyboardHintsFooter.tsx` (CREATE)
- **Do**:
  1. Fixed position: `fixed bottom-6 right-6`
  2. Style: `bg-linear-bg-elevated border border-linear-border-subtle rounded-xl px-5 py-4`
  3. Show hints: J (Next), K (Prev), Enter (Open), N (New), Cmd+K (Commands)
  4. Use `text-xs`, keyboard keys styled as `px-1.5 py-0.5 rounded bg-linear-bg-tertiary`
- **Done when**: Component renders matching mockup design

---

## Sequential: After Group 1

### Task 2: Wire Context Panel into AppShell

- **Depends on**: Task 1.1, 1.3
- **File**: `src/components/layout/AppShell.tsx` (MODIFY)
- **Do**:
  1. Import `ContextPanel` and `useUIStore`
  2. Get `sidebarCollapsed`, `contextPanelVisible` from store
  3. Add prop `hideContextPanel?: boolean` to AppShell (for pages like Cases that have own panel)
  4. Compute: `showContextPanel = sidebarCollapsed && contextPanelVisible && !hideContextPanel`
  5. Add after `{children}` in main:
     ```tsx
     {
       showContextPanel && (
         <aside className="w-80 flex-shrink-0 border-l border-linear-border-subtle bg-linear-bg-secondary animate-slideInRight">
           <ContextPanel />
         </aside>
       );
     }
     ```
- **Done when**: Panel appears/disappears based on sidebar state and can be closed

---

## Parallel Group 2: Cases Page Components

> These 2 tasks run simultaneously via sub-agents. No file conflicts.

### Task 3.1: Create CaseListItem Component

- **File**: `src/components/cases/CaseListItem.tsx` (CREATE)
- **Do**:
  1. Match mockup structure exactly:
     - Container: `py-4 px-6 border-b border-linear-border-subtle cursor-pointer`
     - Selected state: `bg-[#2A2A2A] border-l-2 border-linear-accent`
     - Hover state: `hover:bg-[#222222]`
  2. Layout:
     - Header row: status dot (8px), case number (mono, accent), date (ml-auto)
     - Title: 14px font-medium
     - Client: 13px tertiary
     - Tags row: flex gap-2, mt-2.5
  3. Props: `case`, `isSelected`, `onClick`
  4. Use exact colors from mockup: `#6366F1` accent, `#22C55E` success, `#F59E0B` warning
- **Done when**: Component matches mockup pixel-perfect

### Task 3.2: Create CaseDetailTabs Component

- **File**: `src/components/cases/CaseDetailTabs.tsx` (CREATE)
- **Do**:
  1. Use Radix Tabs with underline variant from `src/components/ui/Tabs.tsx`
  2. Tabs: Detalii | Documente | Sarcini | Email | Pontaj
  3. Create content components for each tab (can be placeholder content initially)
  4. "Detalii" tab shows case info grid matching mockup:
     - Section titles: 11px uppercase font-semibold
     - Info grid: label (12px tertiary) + value (14px primary)
     - Sections: Informații generale, Părți implicate, Termene, Note
  5. Tab text: 13px font-medium, active has `border-b-2 border-linear-accent`
- **Done when**: Tabs render with Detalii content matching mockup structure

---

## Parallel Group 3: Cases Page Panels

> These 2 tasks run simultaneously via sub-agents. No file conflicts.

### Task 4.1: Create CaseListPanel Component

- **File**: `src/components/cases/CaseListPanel.tsx` (CREATE)
- **Do**:
  1. Container: `w-[400px] flex-shrink-0 border-r border-linear-border-subtle flex flex-col bg-linear-bg-secondary`
  2. Header section:
     - Title "Cazuri" (16px font-semibold)
     - Search input (existing pattern from codebase)
     - Filter buttons row (Status, Type dropdowns)
  3. List section:
     - `ScrollArea` with `flex-1`
     - Map cases to `CaseListItem` components
     - Pass selection state from casesStore
  4. Props: `cases`, `selectedCaseId`, `onSelectCase`
- **Done when**: Panel renders with header, search, filters, and scrollable list

### Task 4.2: Create CaseDetailPanel Component

- **File**: `src/components/cases/CaseDetailPanel.tsx` (CREATE)
- **Do**:
  1. Container: `flex-1 flex flex-col overflow-hidden bg-linear-bg-primary`
  2. Header section:
     - Case title (24px font-semibold)
     - Case number + status badge
     - Action buttons (Edit, Archive, etc.)
  3. Include `CaseDetailTabs` below header
  4. Empty state when no case selected:
     - Center content: icon + "Selectează un caz" message
  5. Props: `case` (nullable)
- **Done when**: Panel renders case details or empty state correctly

---

## Sequential: Final Integration

### Task 5: Rebuild Cases Page

- **Depends on**: All above tasks
- **File**: `src/app/(dashboard)/cases/page.tsx` (REBUILD)
- **Do**:
  1. Import new components: `CaseListPanel`, `CaseDetailPanel`, `KeyboardHintsFooter`
  2. Import and use `useCaseKeyboardNav` hook
  3. Get cases and selection from `useCasesStore`
  4. Layout structure:
     ```tsx
     <div className="flex flex-1 overflow-hidden">
       <CaseListPanel
         cases={filteredCases}
         selectedCaseId={selectedCaseId}
         onSelectCase={selectCase}
       />
       <CaseDetailPanel case={selectedCase} />
     </div>
     <KeyboardHintsFooter />
     ```
  5. Pass `hideContextPanel={true}` to parent layout if using AppShell wrapper
  6. Remove old grid/list view toggle logic (now always master-detail)
- **Done when**: Page renders with new layout, keyboard nav works

### Task 6: Integration Testing & Verification

- **Depends on**: Task 5
- **Do**:
  1. Run `npm run type-check` - fix any TypeScript errors
  2. Run `npm run lint` - fix any linting issues
  3. Manual testing:
     - Verify keyboard shortcuts (J/K/Enter/N) work
     - Verify context panel appears when sidebar collapsed (on other pages)
     - Verify cases page does NOT show context panel
     - Verify case selection updates detail panel
  4. Compare against mockup `mockups/03-cases-superhuman.html`
- **Done when**: All checks pass, visual matches mockup

---

## Session Scope Assessment

- **Total tasks**: 10
- **Estimated complexity**: Medium-Complex
- **Checkpoint recommended at**: After Task 5 (before final testing)

## File Summary

| File                                           | Action  | Task |
| ---------------------------------------------- | ------- | ---- |
| `src/store/uiStore.ts`                         | MODIFY  | 1.1  |
| `src/hooks/useCaseKeyboardNav.ts`              | CREATE  | 1.2  |
| `src/components/layout/ContextPanel.tsx`       | CREATE  | 1.3  |
| `src/components/cases/KeyboardHintsFooter.tsx` | CREATE  | 1.4  |
| `src/components/layout/AppShell.tsx`           | MODIFY  | 2    |
| `src/components/cases/CaseListItem.tsx`        | CREATE  | 3.1  |
| `src/components/cases/CaseDetailTabs.tsx`      | CREATE  | 3.2  |
| `src/components/cases/CaseListPanel.tsx`       | CREATE  | 4.1  |
| `src/components/cases/CaseDetailPanel.tsx`     | CREATE  | 4.2  |
| `src/app/(dashboard)/cases/page.tsx`           | REBUILD | 5    |

## Next Step

Start a new session and run:

```
/implement plan-adaptive-layout
```
