# Investigation: Calendar Events Not Saved

**Slug**: calendar-events
**Date**: 2026-01-18
**Status**: Investigation Complete
**Severity**: High
**Next step**: `/debug calendar-events` to implement fix

---

## Bug Summary

**Reported symptom**: Events created from the /calendar new event modal don't appear on the calendar after saving.

**Reproduction steps**:

1. Navigate to /calendar
2. Click "Eveniment Nou" (New Event) button
3. Fill in event details (title, type, date, time, etc.)
4. Click "Creează eveniment" (Create Event)
5. Modal closes but event is not visible on calendar

**Expected behavior**: Event should appear on the calendar after creation.
**Actual behavior**: Modal closes without error, but event is missing from calendar.
**Frequency**: Every time

---

## Root Cause Analysis

### The Bug

**Root cause**: The `useCreateEvent` hook refetches `GET_TASKS` after mutation, but the calendar uses `GET_CALENDAR_EVENTS` - a different Apollo query that is not automatically invalidated.

**Location**: `apps/web/src/hooks/useCreateEvent.ts:74-76`

**Code path**:

```
User submits form → EventForm.handleSubmit → useCreateEvent.createEvent
→ Mutation runs → refetchQueries: GET_TASKS (not GET_CALENDAR_EVENTS!)
→ onSuccess() → handleFormSuccess() → refetchEvents()
```

**Type**: Cache/Query synchronization bug

### Why It Happens

The mutation in `useCreateEvent.ts` is configured to refetch `GET_TASKS`:

```typescript
// apps/web/src/hooks/useCreateEvent.ts:74-76
const [createEventMutation, { loading, error }] = useMutation<...>(CREATE_EVENT, {
  refetchQueries: [{ query: GET_TASKS }],  // ← Wrong query!
});
```

But the calendar page uses `useCalendarEvents` which queries with `GET_CALENDAR_EVENTS`:

```typescript
// apps/web/src/hooks/useCalendarEvents.ts:256-262
const { data, loading, error, refetch } = useQuery<{ tasks: TaskFromAPI[] }>(
  GET_CALENDAR_EVENTS,  // ← Different query
  { ... }
);
```

While `handleFormSuccess` does call `refetchEvents()` to trigger a refetch of `GET_CALENDAR_EVENTS`, this is an **asynchronous** operation that runs **after** the form closes. There may be race conditions or the refetch may not complete successfully.

The fundamental issue is that `GET_CALENDAR_EVENTS` should be in `refetchQueries` to ensure Apollo's cache is properly invalidated after the mutation.

### Why It Wasn't Caught

1. Both `GET_TASKS` and `GET_CALENDAR_EVENTS` query the same `tasks` resolver on the backend, so they appear functionally equivalent
2. The form closes successfully, giving the impression the save worked
3. No error is displayed because the mutation does succeed - only the cache refresh is broken
4. Manual page refresh would show the event, masking the cache issue during testing

---

## Impact Assessment

**Affected functionality**:

- Creating events from the calendar page
- Creating events via keyboard shortcut (E key)
- Creating events via slot click context menu

**Blast radius**: Moderate - affects all event creation from calendar, but events are actually saved to database

**Related code**:

- `apps/web/src/hooks/useCreateEvent.ts`: Contains the misconfigured refetchQueries
- `apps/web/src/app/(dashboard)/calendar/page.tsx`: Calendar page that consumes events
- `apps/web/src/hooks/useCalendarEvents.ts`: Hook that fetches calendar data
- `apps/web/src/graphql/queries.ts`: Defines both GET_TASKS and GET_CALENDAR_EVENTS

**Risk of similar bugs**: Medium - other mutations may have similar refetchQueries mismatches

---

## Proposed Fix Approaches

### Option A: Add GET_CALENDAR_EVENTS to refetchQueries (Recommended)

**Approach**: Update `useCreateEvent` to refetch both `GET_TASKS` and `GET_CALENDAR_EVENTS` after the mutation.

**Files to change**:

- `apps/web/src/hooks/useCreateEvent.ts`: Add GET_CALENDAR_EVENTS to refetchQueries array

**Code change**:

```typescript
import { GET_TASKS, GET_CALENDAR_EVENTS } from '@/graphql/queries';

const [createEventMutation, { loading, error }] = useMutation<...>(CREATE_EVENT, {
  refetchQueries: [
    { query: GET_TASKS },
    { query: GET_CALENDAR_EVENTS },
  ],
});
```

**Pros**:

- Simple, targeted fix
- Ensures Apollo cache is properly invalidated
- Works reliably without race conditions

**Cons**:

- Fetches calendar events even when not on calendar page (minor network overhead)

**Risk**: Low

### Option B: Use Apollo cache update function

**Approach**: Instead of refetchQueries, use the `update` function to manually update the Apollo cache with the new event.

**Files to change**:

- `apps/web/src/hooks/useCreateEvent.ts`: Add cache update logic

**Pros**:

- More efficient - no extra network request
- Immediate UI update

**Cons**:

- More complex implementation
- Need to handle cache normalization correctly
- Harder to maintain

**Risk**: Medium

### Recommendation

**Option A** is recommended. It's simple, reliable, and follows the existing pattern in the codebase. The minor network overhead is acceptable since event creation is not a high-frequency operation.

---

## Testing Requirements

After fix is implemented, verify:

1. [ ] Create event from "Eveniment Nou" button - event appears immediately on calendar
2. [ ] Create event via E keyboard shortcut - event appears immediately
3. [ ] Create event via slot click → "Eveniment" menu - event appears immediately
4. [ ] Create event with different types (Meeting, CourtDate, etc.) - all types appear correctly
5. [ ] Page refresh still shows the event (verify backend save)
6. [ ] Creating event from other pages (if any) still works

### Suggested Test Cases

If adding automated tests:

```typescript
// apps/web/src/hooks/useCreateEvent.test.ts
describe('useCreateEvent', () => {
  it('should refetch GET_CALENDAR_EVENTS after creating event', async () => {
    // Mock Apollo client and verify refetchQueries includes GET_CALENDAR_EVENTS
  });

  it('should show new event on calendar after creation', async () => {
    // E2E test: create event and verify it appears
  });
});
```

---

## Investigation Notes

### Files Examined

| File                                                       | Purpose             | Relevant Finding                                       |
| ---------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| `apps/web/src/app/(dashboard)/calendar/page.tsx`           | Calendar page       | Uses useCalendarEvents with GET_CALENDAR_EVENTS        |
| `apps/web/src/hooks/useCreateEvent.ts`                     | Event creation hook | refetchQueries only includes GET_TASKS                 |
| `apps/web/src/hooks/useCalendarEvents.ts`                  | Calendar data hook  | Uses GET_CALENDAR_EVENTS query                         |
| `apps/web/src/components/forms/EventForm.tsx`              | Event form          | Calls createEvent and onSuccess correctly              |
| `apps/web/src/graphql/queries.ts`                          | GraphQL queries     | GET_TASKS and GET_CALENDAR_EVENTS are separate queries |
| `services/gateway/src/graphql/resolvers/task.resolvers.ts` | Backend resolver    | createEvent mutation works correctly                   |

### Code Flow Analysis

1. **EventForm submission** (EventForm.tsx:137-177):
   - Calls `await createEvent(eventInput)`
   - Then calls `onSuccess?.()` on success

2. **useCreateEvent hook** (useCreateEvent.ts:70-100):
   - Mutation configured with `refetchQueries: [{ query: GET_TASKS }]`
   - Returns after mutation completes

3. **handleFormSuccess** (calendar/page.tsx:567-571):
   - Calls `refetchEvents()` which triggers GET_CALENDAR_EVENTS refetch
   - But this is async and not awaited by the mutation

4. **useCalendarEvents** (useCalendarEvents.ts:241-425):
   - Uses GET_CALENDAR_EVENTS query with fetchPolicy: 'cache-and-network'
   - Transforms data for calendar display

### Secondary Finding: Missing startTime Handling

Events created without a time (startTime) are treated as tasks rather than events in the calendar display:

```typescript
// useCalendarEvents.ts:302
if (isEvent && metadata?.startTime) {
  // Treated as event
} else {
  // Treated as task
}
```

This is a separate minor issue - if a user clears the time field, the event won't display in the events section. The default time from the form should prevent this in normal usage.

---

## Handoff to Fix Phase

This investigation is complete. To implement the fix:

```
/debug calendar-events
```

The debug phase will:

1. Read this investigation document
2. Implement Option A (add GET_CALENDAR_EVENTS to refetchQueries)
3. Verify the fix works
