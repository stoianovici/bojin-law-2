# Brainstorm: Linear-Style Legal Platform UI

**Status**: Complete
**Date**: 2024-12-29
**Next step**: `/research brainstorm-linear-ui`

---

## Context

### Project

- **Path**: `/Users/mio/Developer/bojin-law-ui`
- **Type**: Next.js 16 (App Router) legal case management UI
- **Language**: Romanian (`lang="ro"`)
- **Reference codebase**: `/Users/mio/Developer/bojin-law-2` (old version to study)

### Tech Stack

| Category  | Technology                                  |
| --------- | ------------------------------------------- |
| Framework | Next.js 16 (App Router)                     |
| Language  | TypeScript 5.3+                             |
| Styling   | Tailwind CSS 3.4 + Linear design tokens     |
| State     | Zustand                                     |
| Data      | Apollo Client 4 (GraphQL)                   |
| Auth      | Azure MSAL Browser                          |
| UI        | Radix UI primitives                         |
| Icons     | Lucide React                                |
| Backend   | GraphQL gateway at `localhost:4000/graphql` |

### External Integrations

- **Outlook** (Microsoft Graph API) - email view/reply
- **SharePoint/OneDrive** - document version sync
- **Word/Excel** - external editing, app tracks versions

---

## Problem Statement

Build a Linear-inspired UI for a legal case management platform serving three user tiers (Partner, Asociat, Asociat Jr) with document management, task collaboration, email integration, and timesheets.

**Goal**: Full "Linear design" - visual aesthetic, interaction patterns, and information architecture.

---

## User Roles

| Role       | Visibility           | Special Access                      |
| ---------- | -------------------- | ----------------------------------- |
| Partner    | Firm-wide            | Financials, analytics, all activity |
| Asociat    | Firm-wide operations | No financials                       |
| Asociat Jr | Assigned cases only  | Personal task focus                 |

**Input modes**: Both keyboard shortcuts AND traditional mouse UI required.

---

## Core User Flows

1. **Documents** - manage in-app, edit in Word/Excel, track versions via SharePoint/OneDrive
2. **Tasks** - collaborate, delegate, simple + complex (subtasks, dependencies, approvals, templates)
3. **Email** - view/reply to Outlook emails in-app, threaded + cleaned for readability
4. **Timesheets** - manual time entry per task/case, firm-wide case-based reports
5. **Complex task setup** - templates, dependencies, approval workflows

---

## Decisions

### Navigation Architecture: Hybrid Sidebar + Case Scoping

```
┌─────────────────────────────────────────────────┐
│ [Logo]              [Search] [⌘K] [User]        │
├────────┬────────────────────────────────────────┤
│ Inbox  │ ┌──────────────────────────────────┐   │
│ ────── │ │ Viewing: All Cases │ Filter ▾   │   │
│ Docs   │ ├──────────────────────────────────┤   │
│ Tasks  │ │                                  │   │
│ Email  │ │   Contextual content             │   │
│ Time   │ │   (scoped to case or all)        │   │
│ ────── │ │                                  │   │
│ Pinned │ │                                  │   │
│  Case1 │ └──────────────────────────────────┘   │
│  Case2 │                                        │
└────────┴────────────────────────────────────────┘
```

- Fixed sidebar with main sections
- Pinned/recent cases in sidebar
- **Clicking a case scopes all sections to that case**
- "All Cases" view available per section

### Content Layout: Adaptive

- Master-detail split by default
- `E` or double-click to expand full-width
- Timesheets and complex task setup default to full-page
- User can set preference per section

### Command Palette (⌘K): Everything Accessible

- Navigation (go to sections, cases)
- Creation (new doc, task, email)
- Quick actions (log time, assign task, change status)
- Global search (docs, cases, emails, people)
- Recent items, contextual suggestions

### Keyboard Shortcuts: Dual System

| Style                 | Examples                                  | When Active         |
| --------------------- | ----------------------------------------- | ------------------- |
| Vim-style sequences   | `G I` (Inbox), `G D` (Docs), `C` (Create) | Outside text inputs |
| Traditional modifiers | `⌘1`, `⌘N`, `⌘/`                          | Always              |

### Role-Based Dashboards

**Partner Dashboard** (Firm-wide):

- Firm activity summary
- Financials (billable hours, invoices)
- Attention needed (deadlines, unanswered emails)
- Recent documents

**Asociat Dashboard** (Operations):

- My tasks (due today, this week, waiting)
- My cases with status
- Team activity feed
- Recent documents

**Asociat Jr Dashboard** (Personal focus):

- Today's focus (task checklist)
- My inbox (emails, assignments, mentions)
- My cases (limited view)
- Upcoming deadlines

### Inbox: Unified Notifications

- External: Outlook emails
- Internal: colleague comments, task assignments, task completions
- **Auto-linked to cases**

### Email Integration

- Threaded view, cleaned for maximum readability
- Compose → saves to Outlook drafts (direct send after trust builds)
- Auto-link by sender, subject, email body content
- Manual linking when algorithm confidence < threshold

### Document Management

- Managed in-app (metadata, permissions, linking)
- Edited in Word/Excel externally
- **SharePoint/OneDrive sync** for version tracking
- Version history visible in-app

### Task System

| Type    | Features                                                         |
| ------- | ---------------------------------------------------------------- |
| Simple  | Title, assignee, due date, case link                             |
| Complex | Subtasks/checklists, dependencies, approval workflows, templates |

### Timesheets

- Manual time entry per task/case
- Firm-wide case-based reports for client billing

---

## Rationale

- Linear's patterns are proven for productivity tools
- Hybrid navigation balances cross-case overview with case-focused deep work
- Adaptive layout respects different content needs (quick scan vs deep dive)
- Dual keyboard system accommodates power users and newcomers
- Role-based dashboards reduce noise, surface what matters to each user

---

## Open Questions for Research

### Design System

- [ ] Linear design tokens - exact colors, spacing, typography, shadows
- [ ] Dark theme implementation in Tailwind
- [ ] Radix UI components needed - which primitives map to our needs

### Integrations

- [ ] Microsoft Graph API - Outlook email threading, draft creation
- [ ] SharePoint/OneDrive API - document version sync mechanics
- [ ] Authentication flow with Azure MSAL for Graph API access

### UI Patterns

- [ ] Task dependency visualization - how to represent in UI
- [ ] Email auto-linking algorithm - NLP/matching approach options
- [ ] Complex task templates - data model and UI

### Existing Code

- [ ] Existing data models in bojin-law-2 - what GraphQL types exist
- [ ] Current component patterns - what can we learn/avoid
- [ ] API endpoints available - what backend supports

---

## Next Step

Start a new session and run:

```
/research brainstorm-linear-ui
```

This will spawn agents to investigate the open questions above.
