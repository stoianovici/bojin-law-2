# Brainstorm: Mobile UX

**Status**: Complete
**Date**: 2024-12-29
**Next step**: `/research brainstorm-mobile-ux`

---

## Context

### Project

- **Path**: `/Users/mio/Developer/bojin-law-ui`
- **Type**: Next.js 16 (App Router) legal case management UI
- **Language**: Romanian (`lang="ro"`)
- **Related brainstorm**: `brainstorm-linear-ui.md` (desktop architecture)

### Tech Stack

| Category  | Technology                              |
| --------- | --------------------------------------- |
| Framework | Next.js 16 (App Router)                 |
| Language  | TypeScript 5.3+                         |
| Styling   | Tailwind CSS 3.4 + Linear design tokens |
| State     | Zustand                                 |
| Data      | Apollo Client 4 (GraphQL)               |
| Auth      | Azure MSAL Browser                      |
| UI        | Radix UI primitives                     |

### User Roles

| Role       | Visibility             |
| ---------- | ---------------------- |
| Partner    | Firm-wide + financials |
| Asociat    | Firm-wide operations   |
| Asociat Jr | Assigned cases only    |

---

## Problem Statement

Design mobile UX for the legal platform as a responsive web app. Mobile is for **information checking** with **quick actions close at hand**. Not a full replacement for desktop—focused on what users need on the go.

**Target**: Phones only (tablets deferred to separate session)
**Offline**: No offline capability, but graceful error handling when offline

---

## Decisions

### Navigation Pattern: Collapsible Sections (Linear Mobile Style)

```
┌─────────────────────────────────────┐
│ ≡     All Cases ▾      🔍    [AP]  │
├─────────────────────────────────────┤
│ ▼ My Tasks (3 due today)           │
│   ○ Review Smith contract          │
│   ○ Call client re: deadline       │
│   ● Draft motion (completed)       │
│                                     │
│ ▶ Inbox (5 new)                    │
│ ▶ Recent Cases                     │
│ ▶ Timesheets                       │
├─────────────────────────────────────┤
│            [+ New]                  │
└─────────────────────────────────────┘
```

- Single scrollable page with collapsible/expandable sections
- Tap section header to expand/collapse
- Maintains Linear aesthetic
- Flexible, everything accessible from one screen

### Default View: "My Stuff Across All Cases"

- No case filter by default
- Shows user's tasks, inbox, recent items across entire firm
- Case scoping available when needed (see below)

### Case Scoping

Header shows current scope, tappable to change:

```
┌─────────────────────────────────────┐
│ ≡     Smith v. Jones ▾  🔍    [AP] │  ← Case selected
└─────────────────────────────────────┘
         ↓ Tap opens picker
┌─────────────────────────────────────┐
│ All Cases                    ← Clear│
├─────────────────────────────────────┤
│ Recent                              │
│ ├ Smith v. Jones                    │
│ ├ Popescu Contract                  │
│ └ Ionescu Estate                    │
├─────────────────────────────────────┤
│ 🔍 Search cases...                  │
└─────────────────────────────────────┘
```

When case selected, ALL sections filter to that case.

### Header Bar

```
┌─────────────────────────────────────┐
│ ≡     All Cases ▾      🔍    [AP]  │
│ │         │            │      │     │
│ menu   scope       search   avatar  │
└─────────────────────────────────────┘
```

| Element     | Action                   |
| ----------- | ------------------------ |
| ≡ Hamburger | Opens side menu          |
| Case scope  | Opens case picker        |
| 🔍 Search   | Expands to search bar    |
| Avatar      | Profile / quick settings |

### Hamburger Menu Contents

```
┌─────────────────────────────────────┐
│ Alexandru Popescu                   │
│ Partner                             │
├─────────────────────────────────────┤
│ 📅 Calendar                         │
│ ⚙️ Settings                         │
│ ❓ Help                             │
├─────────────────────────────────────┤
│ 🚪 Logout                           │
└─────────────────────────────────────┘
```

### Calendar

Accessible from hamburger menu. Shows:

- Task deadlines
- Case deadlines
- Court dates
- Meetings

Unified view of all time-sensitive items.

### Role-Specific Home Sections

**Partner:**
| Section | Default State | Content |
|---------|---------------|---------|
| Attention Needed | Expanded | Overdue items, unanswered emails, approaching deadlines |
| Firm Today | Collapsed | Tasks completed, billable hours, activity summary |
| My Tasks | Collapsed | Partner's personal tasks |
| Inbox | Collapsed | Emails + internal notifications |
| Recent Cases | Collapsed | Quick access |

**Asociat:**
| Section | Default State | Content |
|---------|---------------|---------|
| My Tasks | Expanded | Due today, this week, waiting |
| Inbox | Collapsed | Emails + internal notifications |
| Attention Needed | Collapsed | Deadlines, blocked items |
| Recent Cases | Collapsed | Quick access |
| Timesheets | Collapsed | Quick time entry |

**Asociat Jr:**
| Section | Default State | Content |
|---------|---------------|---------|
| Today's Focus | Expanded | Checklist of today's tasks |
| Inbox | Collapsed | Assignments, mentions, emails |
| My Cases | Collapsed | Limited to assigned cases |
| Timesheets | Collapsed | Quick time entry |

### Quick Actions: Bottom Sheet

Tapping [+ New] opens bottom sheet:

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │  📋 Create Task                 │ │
│ │  📝 Add Note                    │ │
│ │  ⏱ Log Time                    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

Each opens a focused creation form.

### Quick Reply: Contextual Only

- **Not** available from bottom sheet
- Only appears when viewing an email or colleague comment
- Inline reply UI within the message view

```
┌─────────────────────────────────────┐
│ ← Email from Ion Popescu            │
├─────────────────────────────────────┤
│ Subject: Contract review            │
│                                     │
│ Hi Alexandru,                       │
│                                     │
│ Please review the attached...       │
│                                     │
├─────────────────────────────────────┤
│ [Reply]  [Forward]  [···]          │
└─────────────────────────────────────┘
```

Same pattern for colleague comments in task/document threads.

### Task Completion: Dual Interaction

| Method       | Interaction                       |
| ------------ | --------------------------------- |
| Checkbox tap | Tap ○ directly to complete        |
| Swipe right  | Swipe task item right to complete |

Both supported. Swipe provides satisfying quick interaction; checkbox is discoverable.

Visual feedback:

- Swipe reveals green "Complete" indicator
- Completed tasks show ● filled circle + strikethrough
- Brief celebration animation (subtle, Linear-style)

### Search (Expanded)

Tapping 🔍 expands to full search:

```
┌─────────────────────────────────────┐
│ ← 🔍 Search...                      │
├─────────────────────────────────────┤
│ Recent                              │
│ ├ Smith contract                    │
│ ├ Ion Popescu                       │
├─────────────────────────────────────┤
│ Try: cases, tasks, documents, people│
└─────────────────────────────────────┘
```

- Search across: cases, tasks, documents, emails, people
- Results grouped by type
- Recent searches shown initially

### Push Notifications

Mobile web push notifications for:

- Task assignments
- Task mentions (@name)
- New emails (important/from clients)
- Deadline reminders
- Colleague comments on your items

User can configure notification preferences in Settings.

### Offline Handling

No offline capability, but graceful degradation:

```
┌─────────────────────────────────────┐
│ ⚠️ You're offline                   │
│                                     │
│ Last synced: 5 minutes ago          │
│                                     │
│ [Retry]                             │
└─────────────────────────────────────┘
```

- Show cached content if available (read-only)
- Disable action buttons when offline
- Auto-retry when connection restored
- Toast notification when back online

---

## Rationale

- **Collapsible sections** match Linear mobile and keep everything accessible without deep navigation
- **Role-specific sections** reduce noise—Partners need firm overview, Asociat Jr needs personal focus
- **"My stuff" default** fits mobile's quick-check use case
- **Contextual Quick Reply** avoids confusing "which message?" flows
- **Dual task completion** (tap + swipe) serves both discoverable and power-user needs
- **Push notifications** make mobile useful for staying informed
- **Graceful offline** avoids frustrating errors without complex offline-first architecture

---

## Open Questions for Research

### Technical

- [ ] Responsive breakpoints - what widths define mobile vs tablet vs desktop
- [ ] Tailwind responsive patterns - best practices for collapsible sections
- [ ] Web push notifications - service worker setup in Next.js 16
- [ ] Swipe gesture library - options that work well with React/Radix

### Design

- [ ] Linear mobile - study their actual implementation for reference
- [ ] Collapsible section animation - smooth expand/collapse patterns
- [ ] Bottom sheet component - Radix/Vaul options

### Integration

- [ ] Push notification service - Firebase? OneSignal? Native web push?
- [ ] Calendar data sources - how to unify deadlines + events from backend

---

## Deferred

- **Tablet UX** - separate brainstorm session
- **Offline-first** - not needed per requirements

---

## Next Step

Start a new session and run:

```
/research brainstorm-mobile-ux
```

This will investigate the open questions above.
