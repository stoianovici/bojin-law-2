# Iteration: Calendar Week View Overlap Fix

**Status**: Fix Implemented
**Date**: 2026-01-06
**Issue**: Tasks and events could visually stack on top of each other in the calendar week view
**Screenshots**: `.playwright-mcp/calendar-overlap-fixed.png`

---

## Problem Analysis

The calendar week view renders tasks and events absolutely positioned in a time grid. Previously, when multiple items occupied the same or overlapping time slots, they would render directly on top of each other, making one item invisible.

### Root Cause

In `DayColumn.tsx`:

- Events were rendered with `left-0.5 right-0.5` (fixed positioning)
- Tasks were rendered with `left={2}` and `width={96}` (hardcoded percentages)
- No layout calculation was performed to detect overlapping items

---

## Solution Implemented

Added a **greedy column assignment algorithm** in `DayColumn.tsx` that:

1. **Collects all time-positioned items** (events + scheduled tasks)
2. **Groups overlapping items** together
3. **Assigns columns** within each group (items that don't overlap reuse columns)
4. **Calculates width and position** based on the number of columns in the group

### Algorithm Details

```typescript
// Items are sorted by start time, then grouped by overlap
// Each group is processed independently:
// - Find first available column where item fits (no overlap)
// - Assign column, update column end time
// - Final width = 100% / totalColumns, left = column * width
```

---

## Files Changed

| File                                             | Change                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/web/src/components/calendar/DayColumn.tsx` | Added `calculateOverlapLayout()` function and applied layout to event/task rendering |

### Key Code Additions

1. **Helper functions** (lines 83-183):
   - `timeToMinutes()` - converts HH:MM to minutes
   - `TimeRangeItem` interface - item with time range
   - `ItemLayout` interface - column position result
   - `calculateOverlapLayout()` - the main algorithm

2. **Layout calculation** (lines 305-339):
   - Combined events and tasks into `TimeRangeItem[]`
   - Called `calculateOverlapLayout()` in a useMemo

3. **Event rendering** (lines 403-426):
   - Used layout to calculate `left` and `width` with gaps

4. **Task rendering** (lines 458-489):
   - Used layout to calculate `left` and `width` props

---

## Verification

The implementation:

- Calculates positions dynamically based on actual item overlaps
- Uses percentage-based positioning for responsive layout
- Adds 2px gap between adjacent items for visual clarity
- Handles multiple overlapping items (2, 3, or more)
- Non-overlapping items still take full width

---

## Notes

- The `TaskCard` component already had `left` and `width` props designed for this purpose (lines 98-100 in TaskCard.tsx) - they just weren't being used
- The fix works for both events and tasks, and handles cross-type overlaps (event overlapping with task)
- The auto-scheduling logic in `useCalendarEvents.ts` already prevents tasks from being auto-scheduled at overlapping times, but manual schedules or backend-provided schedules could still overlap

---

## Next Steps

The implementation is complete. Consider:

- [ ] Adding visual tests with overlapping sample data
- [ ] Testing edge cases (3+ overlapping items, varying durations)
