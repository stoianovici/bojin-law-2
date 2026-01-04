# Brainstorm: Adaptive Layout System

**Status**: Complete
**Date**: 2025-12-31
**Next step**: `/research brainstorm-adaptive-layout`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Radix UI
**Design system**: Linear-inspired dark theme

### Current State

- Sidebar collapses from 240px (`w-60`) to 64px (`w-16`), freeing ~176px
- Main content uses `flex-1` but internal content doesn't adapt
- Cases page has grid/list view with optional right drawer - doesn't match mockup
- Mockup exists: `mockups/03-cases-superhuman.html` (Superhuman-style 3-panel)

### Key Files

- `src/components/layout/AppShell.tsx` - Main layout wrapper
- `src/components/layout/Sidebar.tsx` - Collapsible sidebar
- `src/app/(dashboard)/layout.tsx` - Dashboard layout with auth
- `src/store/uiStore.ts` - UI state (sidebarCollapsed, sidebarOpen)

---

## Problem Statement

When the sidebar collapses, ~176px of horizontal space is freed but not utilized. The content simply stretches without providing additional value. We want to:

1. **Add a contextual panel** that appears when space is available, showing page-specific content or a default activity feed
2. **Rebuild the cases page** to use a Superhuman-style master-detail layout (which inherently uses all available space)

---

## Decisions

### Part 1: Contextual Panel System

#### Architecture

A 320px panel that appears on the right side when:

- Sidebar is collapsed (64px)
- User hasn't dismissed it
- Viewport is wide enough (min ~1200px total)

```
Sidebar Expanded (240px):
┌──────────┬─────────────────────────────────────────────┐
│          │                                             │
│ Sidebar  │              Main Content                   │
│  240px   │                (flex-1)                     │
│          │                                             │
└──────────┴─────────────────────────────────────────────┘

Sidebar Collapsed (64px) + Panel:
┌────┬────────────────────────────────┬──────────────────┐
│    │                                │                  │
│ 64 │        Main Content            │ Contextual Panel │
│ px │          (flex-1)              │     (320px)      │
│    │                                │                  │
└────┴────────────────────────────────┴──────────────────┘
```

#### Panel Visibility Logic

| Sidebar   | Panel Preference | Viewport  | Panel Shows |
| --------- | ---------------- | --------- | ----------- |
| Expanded  | Any              | Any       | Hidden      |
| Collapsed | Visible          | >= 1200px | Shows       |
| Collapsed | Visible          | < 1200px  | Hidden      |
| Collapsed | Hidden           | Any       | Hidden      |

#### Content Priority

1. **Page-specific content** (if page provides it)
2. **Activity Feed** (default fallback)

#### Per-Page Content

| Page          | Panel Content                                            |
| ------------- | -------------------------------------------------------- |
| **Dashboard** | May not need (already info-dense) or show today's agenda |
| **Cases**     | NO PANEL - uses Superhuman layout instead                |
| **Tasks**     | Task details when selected, or "Today's Focus" list      |
| **Calendar**  | Event details when selected, or today's schedule         |
| **Email**     | Email preview when selected                              |
| **Documents** | Document preview / AI summary                            |
| **Time**      | Running timer widget, today's total, quick entry         |

#### Activity Feed (Default)

Shows recent actions across the platform:

- Document uploads
- Task completions
- Case updates
- Email received
- Time entries logged

#### UI State

Add to `uiStore`:

```typescript
contextPanelVisible: boolean  // User preference
setContextPanelVisible: (visible: boolean) => void
```

#### Dismissibility

- Panel has a close button (X) in header
- Persists user preference in store (localStorage via Zustand persist)
- Can be re-opened via a button in header or keyboard shortcut

---

### Part 2: Cases Page Rebuild

#### Target Layout (from mockup)

Superhuman-style 3-panel master-detail:

```
┌────┬───────────────────┬──────────────────────────────────┐
│    │ Case List (400px) │ Case Detail (flex-1)             │
│ S  │                   │                                  │
│ i  │ ┌─────────────┐   │ Title + Status + Actions         │
│ d  │ │ Search      │   │ ─────────────────────────────    │
│ e  │ └─────────────┘   │ Tabs: Detalii|Docs|Sarcini|...   │
│ b  │ Filters: Active.. │ ─────────────────────────────    │
│ a  │ ─────────────────  │                                  │
│ r  │ • Case 1 (sel)    │ Content based on active tab      │
│    │ • Case 2          │                                  │
│    │ • Case 3          │                                  │
│    │ • ...             │                                  │
└────┴───────────────────┴──────────────────────────────────┘
```

#### Key Differences from Current

| Aspect      | Current                       | Target                      |
| ----------- | ----------------------------- | --------------------------- |
| Layout      | Grid/List cards               | Master-detail panels        |
| Case list   | Full width, card grid         | Fixed 400px left panel      |
| Case detail | Optional right drawer (380px) | Main content area (flex-1)  |
| Selection   | Click opens drawer            | Click shows in detail panel |
| View toggle | Grid/List                     | Not needed (always list)    |

#### Case List Panel (400px)

- Header: Title + "Caz nou" button
- Search input
- Filter buttons: Active (default), Toate, Arhivate
- Scrollable case list with:
  - Status dot (green=active, yellow=pending, gray=onhold)
  - Case number (mono font, accent color)
  - Date (relative: Azi, Ieri, 25 dec)
  - Case title
  - Client name
  - Tags (type, category)
- Selected case has left border accent + bg-selected

#### Case Detail Panel (flex-1)

- Header:
  - Title (24px, semibold)
  - Meta: case number, status dot + label, court
  - Actions: Editeaza, Sarcina noua
- Tab navigation: Detalii | Documente | Sarcini | Email | Pontaj
- Content area (scrollable):
  - **Detalii tab**: Info grid (client, type, court, object, next hearing, value), Team list, Recent activity
  - **Other tabs**: TBD (likely reuse existing components)

#### Keyboard Navigation (from mockup)

- `J` - Next case
- `K` - Previous case
- `Enter` - Open/focus detail
- `N` - New case
- `Cmd+K` - Command palette

#### Empty State

When no case is selected, show:

- Helpful message or first case auto-selected

---

## Rationale

### Why Contextual Panel?

- Users who collapse sidebar want more workspace
- Activity feed provides ambient awareness without switching pages
- Page-specific content surfaces relevant actions contextually
- Independent dismissibility respects user preference

### Why Superhuman Layout for Cases?

- Legal work involves frequent case switching - master-detail is faster
- Detail panel has room for rich content (tabs, activity, team)
- Matches existing mockup (source of truth)
- Keyboard navigation enables power-user workflows
- Eliminates need for contextual panel on this page

### Why 320px Panel / 400px Case List?

- 320px: Enough for activity items, not so wide it crowds main content
- 400px: Matches mockup, enough for case info without truncation

---

## Open Questions for Research

- [ ] How should the contextual panel animate in/out? (slide, fade, instant)
- [ ] Should there be a "reopen panel" affordance in the header when dismissed?
- [ ] How to handle responsive breakpoints below 1200px?
- [ ] For cases: should first case auto-select on load, or show empty state?
- [ ] Keyboard shortcut to toggle contextual panel? (suggestion: `Cmd+.`)
- [ ] Should activity feed be real-time (websocket) or polling?
- [ ] Case list: virtual scrolling needed for large case counts?

---

## Implementation Scope

### Contextual Panel System

1. Extend `uiStore` with panel visibility state
2. Modify `AppShell` to render optional right panel
3. Create `<ContextPanel>` component with close button
4. Create `<ActivityFeed>` component (default content)
5. Create hook `useContextPanelContent()` for page-specific overrides
6. Add panel toggle affordance somewhere (header? keyboard?)

### Cases Page Rebuild

1. New layout: `CaseListPanel` (400px) + `CaseDetailPanel` (flex-1)
2. Refactor case list to vertical scrolling list (not grid)
3. Build case detail with tabs
4. Implement keyboard navigation (J/K/Enter/N)
5. Add keyboard hints footer
6. Remove old grid/list view toggle

---

## Next Step

Start a new session and run:

```
/research brainstorm-adaptive-layout
```
