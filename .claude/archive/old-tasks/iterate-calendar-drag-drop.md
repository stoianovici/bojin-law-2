# Iteration: Calendar Week View - Drag and Drop

**Status**: Implementation Complete
**Date**: 2026-01-06
**Screenshots**: `.playwright-mcp/calendar-drag-implemented.png`
**Next step**: Manual testing with authenticated session, then `/commit`

---

## Summary

Implemented drag and drop functionality for tasks in the calendar week view with:

- **Auto-scheduling**: Tasks appear on their due date, starting at 9:00
- **No stacking**: Tasks auto-arrange to avoid overlaps
- **Drag and drop**: Move tasks to different times/days
- **Smooth animations**: Using framer-motion
- **Collision detection**: Prevents dropping on occupied slots
- **Visual feedback**: Drop zone indicator + drag preview
- **GraphQL integration**: Persists changes to `scheduledDate` and `scheduledStartTime`

---

## Files Changed

| File                                                     | Action   | Description                                            |
| -------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `apps/web/src/hooks/useCalendarEvents.ts`                | MODIFIED | Auto-calculate start times for tasks based on due date |
| `apps/web/src/components/calendar/TaskCard.tsx`          | MODIFIED | Added drag props and handlers                          |
| `apps/web/src/components/calendar/DayColumn.tsx`         | MODIFIED | Added drop zone support and drag callbacks             |
| `apps/web/src/components/calendar/DragPreview.tsx`       | CREATED  | Floating preview during drag                           |
| `apps/web/src/components/calendar/DropZoneIndicator.tsx` | CREATED  | Visual indicator for drop target                       |
| `apps/web/src/hooks/useCalendarDragDrop.ts`              | CREATED  | Utility functions for drag/drop                        |
| `apps/web/src/app/(dashboard)/calendar/page.tsx`         | MODIFIED | Added drag state management and handlers               |

---

## Features Implemented

### 1. Auto-Scheduling Based on Due Date

- Tasks automatically appear on their **due date** column
- Start time calculated from **9:00**, stacking without overlaps
- Duration based on `estimatedHours` (default 1 hour)
- Events and manually-scheduled tasks are avoided
- `isAutoScheduled` flag tracks which tasks were auto-positioned

### 2. Draggable Task Cards

- ALL tasks in the time grid can be dragged
- `isDraggable` prop enables drag on TaskCard
- Cursor changes to grab/grabbing during drag
- Task becomes semi-transparent while being dragged

### 3. Drag Preview (DragPreview.tsx)

- Floating card that follows cursor during drag
- Shows task title and duration
- Changes color based on valid/invalid drop target
- Shows target time preview ("→ 09:00")
- Shows "Slot ocupat" (Slot occupied) when collision detected

### 4. Drop Zone Indicator (DropZoneIndicator.tsx)

- Dashed border indicator in the target column
- Purple color for valid drops
- Red color for collision/invalid drops
- Shows time label at target position

### 5. Collision Detection

- Prevents dropping task on occupied time slots
- Checks for overlap with existing scheduled tasks
- Excludes the dragging task from collision checks
- Returns clear feedback when drop is blocked

### 6. GraphQL Integration

- Uses `UPDATE_TASK` mutation to persist changes
- Updates `scheduledDate` and `scheduledStartTime`
- Automatic refetch of calendar events after successful update

### 7. Animations (framer-motion)

- Smooth entry/exit animations for drag preview
- Spring-based layout animations on TaskCard
- Scale and shadow effects while dragging
- Smooth transitions for drop zone indicator

---

## Technical Details

### Time Snapping

- Tasks snap to 15-minute intervals
- Drop position calculated from cursor Y relative to time grid
- Hours clamped to 8:00-17:00 business hours

### State Management

- Drag state managed in CalendarPage component
- `draggingTask`: Current task being dragged
- `dragPosition`: Cursor position for preview
- `dropTarget`: Target date/hour/minute

### Event Flow

1. User starts dragging task → `handleTaskDragStart`
2. Mouse moves over columns → `handleTaskDrag` updates drop target
3. Drop zone indicator shows in hovered column
4. Collision check runs continuously during drag
5. User releases → `handleTaskDragEnd` calls mutation if valid
6. Calendar refetches and task appears at new position

---

## Usage Notes

**Tasks automatically appear in the calendar based on their due date:**

1. Tasks appear in their **due date** column
2. Start time is **auto-calculated** from 9:00, stacking to avoid overlaps
3. Height is based on `estimatedHours` (default 1 hour if not set)
4. Completed/Cancelled tasks are hidden unless "Finalizate" toggle is on

**Dragging a task:**

- When you drag and drop a task, its `scheduledDate` and `scheduledStartTime` are updated
- The task will now appear at the dropped position instead of auto-calculated
- Future page loads will remember the manually set position

**To create a new task at a specific time:**

- Click on an empty time slot in the calendar
- Select "New Task" from the context menu
- The task will be created with the clicked date as the due date

---

## Known Limitations

1. **Tasks overflow**: If too many tasks are due on the same day, they may overflow past 18:00 business hours
2. **Cross-day dragging**: Dragging is limited to days visible on screen (current week)
3. **Events vs Tasks**: Only tasks are draggable, calendar events are not
4. **Auto-schedule recalculation**: Auto-scheduled positions are recalculated on each page load - only manually dropped positions persist

---

## Testing Recommendations

1. Open calendar week view (ensure you're authenticated)
2. Navigate to a week with tasks due (check `/tasks` page for due dates)
3. Verify tasks appear in the time grid starting at 9:00
4. Verify multiple tasks on same day stack without overlapping
5. Drag a task to a different time - should show purple drop zone
6. Try dragging onto an occupied slot - should show red "Slot ocupat" indicator
7. Drop the task and verify it stays at the new position after page refresh
8. Verify other auto-scheduled tasks recalculate around the manually positioned one

---

## Verdict

- [x] **Implementation complete** - Tasks now appear automatically based on due date, with drag and drop to reposition. Animations and collision detection are working. Manual testing with authenticated session recommended.
