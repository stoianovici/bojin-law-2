# Brainstorm: FAB Visibility & Contextual Behavior

**Status**: Complete
**Date**: 2026-01-01
**Next step**: `/research brainstorm-fab-visibility`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS
**Design system**: Superhuman-inspired dark theme (see `.claude/docs/mobile-ux.md`)

**Current state**: FAB exists but appears everywhere and always shows "+ Nou" label. Needs to be contextual and smarter about when to appear.

**Relevant files**:

- `src/app/m/page.tsx` - Home
- `src/app/m/cases/page.tsx` - Cases list
- `src/app/m/cases/[id]/page.tsx` - Case detail
- `src/app/m/calendar/page.tsx` - Calendar
- `src/app/m/search/page.tsx` - Search
- `src/components/mobile/CreateSheet.tsx` - Creation bottom sheet
- `src/components/layout/BottomTabBar.tsx` - Tab bar

---

## Problem Statement

The FAB (Floating Action Button) should be available on main sections but not everywhere. It should:

1. Hide during creation flows (when user is already adding something)
2. Be visible on main tab sections only
3. Be contextual (different behavior per page)
4. Use alternatives (inline actions) on detail pages

---

## Decisions

### 1. FAB Visibility Rules

| Page                          | FAB Visible | Reason                              |
| ----------------------------- | ----------- | ----------------------------------- |
| Home (`/m`)                   | Yes         | Primary action surface              |
| Cases (`/m/cases`)            | Yes         | Main section                        |
| Calendar (`/m/calendar`)      | Yes         | Main section                        |
| Search (`/m/search`)          | **No**      | Search is for finding, not creating |
| Case detail (`/m/cases/[id]`) | **No**      | Use inline action instead           |
| Task detail (`/m/tasks/[id]`) | **No**      | Editing context, not creating       |
| Any sheet/modal open          | **No**      | Already in creation flow            |

### 2. FAB Design Change

**Before**: Pill-shaped with text label "+ Nou"

```
[ + Nou ]  ← pill shape, text label
```

**After**: Circular, icon-only

```
  (  +  )  ← ~56px circle, no text
```

- Remove "Nou" text label
- Change from pill to circular shape (~56px diameter)
- Keep centered position at `bottom-24`
- Keep white background, dark icon

### 3. Contextual FAB Behavior

| Page     | FAB Action                                             |
| -------- | ------------------------------------------------------ |
| Home     | Opens CreateSheet with all options (task, case, event) |
| Cases    | Opens CreateSheet, pre-selects "Case" flow             |
| Calendar | Opens CreateSheet, pre-selects "Event" flow            |

### 4. Detail Page Alternative: Inline "Add Task"

On Case detail page (`/m/cases/[id]`):

- No FAB
- Add "+ Adaugă task" button at the **bottom** of the tasks list
- Styled as inline action button (not floating)

---

## Rationale

1. **Icon-only circular FAB**: More standard pattern for mobile, less visual clutter, universally understood
2. **Hidden on search**: Search is read-only context; users search to find, not create
3. **Hidden on detail pages**: Detail pages have their own context; inline actions are more appropriate
4. **Hidden during creation**: Prevents confusion when user is already in a creation flow
5. **Contextual pre-selection**: Reduces friction by anticipating user intent based on current page

---

## Open Questions for Research

- [ ] How is FAB currently implemented? Is visibility already controllable?
- [ ] How does CreateSheet work? Does it support pre-selecting a creation type?
- [ ] What state management exists for sheet open/closed? (Zustand store?)
- [ ] What does the case detail tasks section look like currently?
- [ ] Are there any mockups for the circular FAB or inline add button?

---

## Implementation Sketch

1. **FAB component changes**:
   - Add `visible` prop or use context
   - Change shape from pill to circle
   - Remove text label

2. **Visibility logic** (likely in layout or context):
   - Track current route
   - Track if any sheet is open
   - Compute `showFAB = isMainTab && !sheetOpen`

3. **Contextual behavior**:
   - Pass `defaultType` prop to CreateSheet based on route
   - Home: no default (show all options)
   - Cases: default to "case"
   - Calendar: default to "event"

4. **Case detail inline action**:
   - Add button after tasks list
   - Opens same CreateSheet with task flow

---

## Next Step

Start a new session and run:

```
/research brainstorm-fab-visibility
```
