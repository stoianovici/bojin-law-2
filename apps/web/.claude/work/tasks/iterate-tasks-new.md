# Iteration: /m/tasks/new Page

**Status**: Complete
**Date**: 2026-01-02
**Screenshots**: `.claude/work/screenshots/tasks-new-*.png`

---

## Issues Addressed

### Issue 1: Content required scrolling

- **Location**: `/m/tasks/new`
- **What was wrong**: Form fields took too much vertical space, requiring scroll
- **Fix applied**:
  - Reduced input padding from `py-3.5` (14px) to `py-2.5` (10px)
  - Reduced input border radius from `rounded-[12px]` to `rounded-[10px]`
  - Reduced spacing between form fields from `space-y-5` to `space-y-4`
  - Reduced label-to-input gap from `space-y-2` to `space-y-1.5`

### Issue 2: Inefficient field layout

- **Location**: `/m/tasks/new`
- **What was wrong**: Each field on separate row, wasting space
- **Fix applied**:
  - Combined Dosar + Tip task on same row
  - Combined Termen (deadline) + Durată est. (estimated duration) on same row

### Issue 3: Missing subtasks functionality

- **Location**: `/m/tasks/new`
- **What was wrong**: No way to add subtasks on mobile
- **Fix applied**:
  - Added Subtaskuri section with "Adaugă subtask" button
  - Implemented inline subtask form with title, assignee, and duration fields
  - Added ability to add multiple subtasks with remove functionality
  - Subtasks display assignee name and duration

### Issue 4: Notes section taking space

- **Location**: `/m/tasks/new`
- **What was wrong**: Optional description field always visible
- **Fix applied**:
  - Made notes collapsible - shows "+ Adaugă note" link when empty
  - Expands to full textarea when clicked

---

## Files Changed

| File                                       | Change                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| `src/app/m/tasks/new/page.tsx`             | Complete restructure with 2-column layouts, subtasks section |
| `src/components/mobile/MobileInput.tsx`    | Reduced padding/spacing                                      |
| `src/components/mobile/MobileSelect.tsx`   | Reduced padding/spacing                                      |
| `src/components/mobile/MobileTextArea.tsx` | Reduced padding/spacing                                      |
| `src/components/mobile/MobileFormPage.tsx` | Reduced content padding                                      |

---

## Before/After

**Before**:

- 8 separate rows of fields
- Required scrolling to see all fields
- No subtasks support

**After**:

- 6 rows (2 are side-by-side pairs)
- All essential fields visible without scroll
- Full subtasks support with add/remove

---

## Verdict

- [x] **Issues fixed** - All requested changes implemented and verified
