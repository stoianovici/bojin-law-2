# Iteration: Desktop /tasks/new Subtask Form

**Status**: Complete
**Date**: 2026-01-02

---

## Issues Addressed

### Issue 1: Deadline + Est Duration on separate rows

- **Location**: `src/app/(dashboard)/tasks/new/page.tsx` - Subtask form
- **What was wrong**: Data scadentă (deadline) and Timp estimat (est. duration) were on separate rows, wasting vertical space
- **Fix applied**: Combined them into a single row with `grid grid-cols-2 gap-3`

### Issue 2: Impossible to add multiple subtasks

- **Location**: Subtask form buttons
- **What was wrong**: After adding one subtask, UX was unclear - "Închide" + "Adaugă" buttons didn't communicate that you could add more
- **Fix applied**:
  - Changed "Închide" to "Gata" (Done)
  - Changed "Adaugă" to "Adaugă și continuă" (Add and continue)
  - Added counter showing how many subtasks have been added
  - Form stays open after adding, allowing multiple entries

### Issue 3: Assignee dropdown invisible

- **Location**: All Select dropdowns in subtask form
- **What was wrong**: SelectContent z-index might be blocked by ScrollArea or parent containers
- **Fix applied**:
  - Added `z-[200]` to all SelectContent in subtask form
  - Added `max-h-[200px]` to assignee dropdown to prevent overflow
  - Added loading placeholder when teamData hasn't loaded
  - Added empty state message when no team members exist

---

## Files Changed

| File                                     | Change                                        |
| ---------------------------------------- | --------------------------------------------- |
| `src/app/(dashboard)/tasks/new/page.tsx` | Restructured subtask form layout, improved UX |

---

## New Subtask Form Layout

**Before**:

- Title (full width)
- Responsabil (full width)
- Data scadentă (full width)
- Tip + Prioritate (2 cols)
- Timp estimat (full width)

**After**:

- Title (full width)
- Responsabil (full width) - with loading/empty states
- Data scadentă + Timp estimat (2 cols) ✓
- Tip + Prioritate (2 cols)

---

## Verdict

- [x] **Issues fixed** - All requested changes implemented
- Type check passing
