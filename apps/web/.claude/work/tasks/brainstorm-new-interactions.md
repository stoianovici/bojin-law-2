# Brainstorm: New Task & Event Interactions

**Status**: Complete
**Date**: 2025-01-02
**Next step**: `/research brainstorm-new-interactions`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Radix UI, Zustand, Apollo GraphQL
**Target**: Desktop UI first (mobile later)
**Design System**: Linear-inspired dark theme with CSS custom properties

---

## Problem Statement

Users need to create new tasks and events. Currently, the header "+" button is a placeholder with no functionality. We need:

1. Working header "+" button (context-aware)
2. Calendar slot click → create task/event at that time
3. Forms for both task and event creation

---

## Decisions

### Interaction Pattern: Floating Popover (Linear-style)

**Calendar interaction flow:**

1. User clicks on a calendar time slot
2. Small context menu appears at cursor position: "New Task" / "New Event"
3. User selects one → full form popover appears anchored to that slot
4. Popover has subtle arrow pointing to the clicked slot
5. Click outside or press Esc to cancel
6. Smart positioning: flip to other side if near screen edge

**Header "+" button:**

- Context-aware based on current view:
  - Calendar view → opens Event form (as modal or popover)
  - Task view → opens Task form
  - Case view → could offer Task/Event choice
- Same form components reused

### Keyboard Shortcuts (Calendar View)

- `T` → Open new task form
- `E` → Open new event form

### Form Behavior

- **Validation**: Block submit until all required fields valid
- **Save**: Optimistic (instant close, sync in background)
- **Cancel**: Click outside, press Esc, or click Cancel button

---

## Data Models

### Task Fields

| Field          | Type          | Required | Default              |
| -------------- | ------------- | -------- | -------------------- |
| Title          | text          | Yes      | -                    |
| Due date       | datetime      | Yes      | Pre-filled from slot |
| Assignee       | multi-select  | Yes      | Current user         |
| Case           | search select | Yes      | -                    |
| Priority       | select        | No       | Normal               |
| Estimated time | duration      | No       | -                    |

### Event Fields

| Field     | Type          | Required | Default              |
| --------- | ------------- | -------- | -------------------- |
| Title     | text          | Yes      | -                    |
| Date/time | datetime      | Yes      | Pre-filled from slot |
| Location  | text          | No       | -                    |
| Attendees | multi-select  | Yes      | Current user         |
| Case      | search select | Yes      | -                    |

### Event Follow-up (separate flow)

After event time passes, user is prompted to add:

- Conclusions
- Notes

This is a separate interaction, not part of the creation form.

---

## Component Structure (Proposed)

```
src/components/
├── forms/
│   ├── TaskForm.tsx          # Task creation/edit form
│   ├── EventForm.tsx         # Event creation/edit form
│   └── fields/
│       ├── CaseSearchField.tsx    # Search case by name
│       ├── UserMultiSelect.tsx    # Select assignee/attendees
│       ├── PrioritySelect.tsx     # Priority dropdown
│       └── DurationInput.tsx      # Estimated time input
├── popovers/
│   ├── CalendarSlotMenu.tsx  # "New Task" / "New Event" context menu
│   └── FormPopover.tsx       # Anchored popover container for forms
└── calendar/
    └── (existing calendar components)
```

---

## Rationale

**Why Floating Popover over Side Panel?**

- Preserves context (user sees where in calendar they're adding)
- Feels lightweight and fast
- Matches Linear/modern app patterns user is familiar with
- "Bubble at click spot" was explicitly requested

**Why Context-Aware Header "+"?**

- Reduces clicks (no menu when context is obvious)
- Consistent with power-user workflows
- Can still show menu in ambiguous contexts (e.g., dashboard)

**Why Optimistic Save?**

- Feels instant and responsive
- Legal tasks/events are not high-risk (can be edited/deleted)
- Background sync with error toast if fails

**Why Required Case Link?**

- Legal context: tasks/events should always relate to a case
- Prevents orphaned items cluttering the system

---

## Open Questions for Research

- [ ] What Radix UI primitives to use? (Popover, DropdownMenu, Dialog?)
- [ ] How does the existing calendar component work? Can we hook into slot clicks?
- [ ] What's the GraphQL mutation structure for creating tasks/events?
- [ ] How to implement smart popover positioning (flip on edge)?
- [ ] What's the user/team member data structure for assignee/attendee selection?
- [ ] Existing form patterns in the codebase to follow?

---

## Next Step

Start a new session and run:

```
/research brainstorm-new-interactions
```
