# Implementation: FAB Visibility & Contextual Behavior

**Status**: Complete
**Date**: 2026-01-01
**Input**: `plan-fab-visibility.md`
**Next step**: `/commit` or more work

---

## Summary

- [x] All tasks completed
- [x] Type-check passing
- [x] Lint: ESLint config issue (pre-existing project issue, unrelated to changes)

## Files Changed

| File                                  | Action   | Purpose                                                               |
| ------------------------------------- | -------- | --------------------------------------------------------------------- |
| src/components/layout/CreateFAB.tsx   | Modified | Circular design, right-aligned, route-based visibility                |
| src/store/uiStore.ts                  | Modified | Added `createSheetDefaultType` state and updated `setShowCreateSheet` |
| src/app/m/cases/[id]/page.tsx         | Modified | Added inline "Adaugă task" button                                     |
| src/components/layout/CreateSheet.tsx | Modified | Pre-selection support via `createSheetDefaultType`                    |

## Task Completion Log

- [x] Task 1.1: CreateFAB - Changed from pill to circular (56px), right-aligned at `right-6`, visibility based on route (`/m`, `/m/cases`, `/m/calendar`), hidden when sheet is open
- [x] Task 1.2: uiStore - Added `createSheetDefaultType` state, updated `setShowCreateSheet(show, defaultType?)` signature
- [x] Task 1.3: Case Detail - Added inline "Adaugă task" button after open tasks list, navigates to `/m/tasks/new?caseId={id}`
- [x] Task 2: CreateSheet - Now uses `createSheetDefaultType` from store to override context-based selection

## Issues Encountered

- ESLint configuration file missing (eslint.config.js required for ESLint v9) - this is a pre-existing project issue, not related to these changes

## Key Changes Detail

### CreateFAB Changes

```tsx
// Before: Pill-shaped, centered
'fixed bottom-24 left-1/2 -translate-x-1/2 z-40',
'flex items-center gap-2 px-7 py-3.5 rounded-full',
// With text "Nou"

// After: Circular, right-aligned, icon-only
'fixed bottom-24 right-6 z-40',
'flex items-center justify-center w-14 h-14 rounded-full',
// Plus icon only, returns null when hidden
```

### Visibility Logic

```tsx
const visibleRoutes = ['/m', '/m/cases', '/m/calendar'];
const shouldShow = visibleRoutes.includes(pathname) && !showCreateSheet;
if (!shouldShow) return null;
```

### Pre-Selection Support

```tsx
// uiStore
setShowCreateSheet: (show, defaultType) =>
  set({
    showCreateSheet,
    createSheetDefaultType: defaultType ?? null,
  });

// CreateSheet
const activeId = createSheetDefaultType ?? contextActiveId;
```

## Next Step

Run `/commit` to commit changes, or continue with more work.
