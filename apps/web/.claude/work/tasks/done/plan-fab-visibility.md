# Plan: FAB Visibility & Contextual Behavior

**Status**: Approved
**Date**: 2026-01-01
**Input**: `research-fab-visibility.md`
**Next step**: `/implement plan-fab-visibility`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand
**Design tokens**: `#0a0a0a` bg, `#fafafa` text, `#3b82f6` accent

## Approach Summary

Transform the FAB from a centered pill-shaped button to a right-aligned circular icon-only button (56px). Add route-based visibility so FAB only appears on main tabs (`/m`, `/m/cases`, `/m/calendar`) and hides on detail pages, search, and when sheets are open. Extend uiStore to support pre-selection of creation type, and add an inline "Add Task" button on case detail pages.

---

## Parallel Group 1

> These tasks run simultaneously via sub-agents

### Task 1.1: CreateFAB - Circular Design & Visibility

- **File**: `src/components/layout/CreateFAB.tsx` (MODIFY)
- **Do**:
  - Import `usePathname` from `next/navigation`
  - Add visibility logic: show only when pathname is exactly `/m`, `/m/cases`, or `/m/calendar`
  - Hide when `showCreateSheet` is true
  - Change design from pill to circular:
    - Remove "Nou" text, keep only Plus icon
    - Size: `w-14 h-14` (56px)
    - Position: `fixed bottom-24 right-6` (right-aligned, not centered)
    - Shape: `rounded-full` (already present)
    - Keep existing colors and shadow
  - Return `null` when FAB should be hidden
- **Done when**: FAB is circular, right-aligned, only visible on main tabs, hidden during sheet

### Task 1.2: uiStore - Pre-Selection State

- **File**: `src/store/uiStore.ts` (MODIFY)
- **Do**:
  - Add state: `createSheetDefaultType: 'case' | 'task' | 'event' | 'note' | null`
  - Initialize as `null`
  - Modify `setShowCreateSheet` signature to: `(show: boolean, defaultType?: 'case' | 'task' | 'event' | 'note' | null) => void`
  - Implementation: `set({ showCreateSheet: show, createSheetDefaultType: defaultType ?? null })`
  - Update TypeScript interface accordingly
- **Done when**: Store exports `createSheetDefaultType` and `setShowCreateSheet` accepts optional type

### Task 1.3: Case Detail - Inline Add Task Button

- **File**: `src/app/m/cases/[id]/page.tsx` (MODIFY)
- **Do**:
  - Locate "Taskuri deschise" section (around line 266)
  - Add inline button after the open tasks list, before "Finalizate" section
  - Button content: Plus icon + "Adaugă task" text
  - Style: ghost/text button, `text-mobile-text-secondary hover:text-mobile-text-primary`
  - Padding: `py-3` for touch target
  - On click: navigate to `/m/tasks/new?caseId={id}` or use router
- **Done when**: Case detail has inline add task button that navigates to task creation

---

## Sequential: After Group 1

### Task 2: CreateSheet - Pre-Selection Support

- **Depends on**: Task 1.2
- **File**: `src/components/layout/CreateSheet.tsx` (MODIFY)
- **Do**:
  - Import `createSheetDefaultType` from uiStore
  - When sheet opens and `createSheetDefaultType` is set:
    - Visually highlight/select that action type
    - Consider auto-scrolling if needed
  - When sheet closes, the store already clears `createSheetDefaultType` (via setShowCreateSheet(false))
  - Update the action button styling to show selected state
- **Done when**: Opening sheet with defaultType pre-highlights the relevant action

---

## Final Steps (Sequential)

### Task 3: Integration & Testing

- **Do**:
  - Test FAB visibility:
    - `/m` → visible (right-aligned, circular)
    - `/m/cases` → visible
    - `/m/calendar` → visible
    - `/m/search` → hidden
    - `/m/cases/[id]` → hidden
    - When CreateSheet open → hidden
  - Test inline add button on case detail page
  - Test CreateSheet pre-selection (if wired up)
  - Run `npm run type-check`
  - Run `npm run lint`
- **Done when**: All tests pass, no TypeScript/lint errors, feature works end-to-end

---

## Session Scope Assessment

- **Total tasks**: 5
- **Estimated complexity**: Medium
- **Checkpoint recommended at**: After Group 1 (verify FAB and inline button before CreateSheet integration)

## Next Step

Start a new session and run:

```
/implement plan-fab-visibility
```
