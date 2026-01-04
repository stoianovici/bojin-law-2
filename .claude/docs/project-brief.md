# Project Brief

## What This Is

AI-powered legal case management platform for Romanian law firms. Integrates with Microsoft 365 for email/calendar, uses AI for document generation, email classification, and workflow automation. Built for Bojin & Associates as the primary user. Production deployment on Render.

## Users & Roles

| Role                 | Romanian    | What they do                                        | What they care about                                     |
| -------------------- | ----------- | --------------------------------------------------- | -------------------------------------------------------- |
| **Partner**          | Partener    | Supervises cases, approves work, reviews financials | High-level visibility, delegation, revenue/profitability |
| **Associate**        | Asociat     | Works cases, drafts documents, manages deadlines    | Efficiency, task clarity, document quality               |
| **Junior Associate** | Asociat Jr. | Supports cases, learns workflows                    | Clear tasks, guidance                                    |
| **Paralegal**        | Paralegal   | Document prep, scheduling, client communication     | Task lists, templates, organization                      |
| **Admin**            | Admin       | System configuration, user management               | Settings, permissions, audit trails                      |

## Key Domain Concepts

| Romanian     | English          | Description                                                                                              |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------------- |
| **Dosar**    | Case             | A legal matter with client, documents, tasks, billing                                                    |
| **Mapă**     | Folder/Binder    | Physical court filing folder with numbered slots (Act 1, Act 2...) - critical for Romanian court filings |
| **ONRC**     | Trade Registry   | Source of company data for Romanian businesses                                                           |
| **Instanță** | Court            | Romanian court system (tribunale, judecătorii, curți de apel)                                            |
| **Termen**   | Hearing/Deadline | Court hearing date or legal deadline                                                                     |

## Constraints (Non-negotiable)

- **UI text in Romanian** - All user-facing text, code stays in English
- **Microsoft 365 integration** - Auth via Azure AD (MSAL), email/calendar via Graph API
- **Role-based access** - Financial data visibility based on role (partners see revenue, others don't)
- **Romanian legal workflows** - Court deadlines, document formats, filing requirements
- **Linear-inspired design** - Dark-first, minimal, high information density

## Design System (Linear-inspired)

| Principle                | What it means                                                           |
| ------------------------ | ----------------------------------------------------------------------- |
| **Dark-first**           | Dark theme is primary; light theme supported. Mobile always dark.       |
| **Minimal chrome**       | Reduce visual noise - subtle borders, no heavy shadows, content-focused |
| **Information density**  | Compact spacing, smaller text (13px base), more data per screen         |
| **Semantic colors**      | Use `linear-*` tokens for colors, not raw values                        |
| **Subtle interactions**  | Hover states via background change, not color change                    |
| **Consistent hierarchy** | bg-primary → bg-secondary → bg-tertiary → bg-elevated                   |

**Key colors:**

- Accent: Blue (`#3B82F6` dark / `#2563EB` light) - primary actions
- Text: `text-linear-text-primary` (main), `secondary` (labels), `tertiary` (hints)
- Backgrounds: Near-black in dark mode (`#0A0A0B`), white in light
- Status: Green (success), Yellow (warning), Red (error), Blue (info)

## Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| **Frontend** | Next.js 14 (App Router), React, TailwindCSS, Radix UI |
| **State**    | Apollo Client (GraphQL), Zustand (local state)        |
| **Backend**  | Node.js, Apollo Server (GraphQL), Prisma ORM          |
| **Database** | PostgreSQL, Redis (caching)                           |
| **Auth**     | Microsoft Azure AD via MSAL                           |
| **AI**       | Anthropic Claude API                                  |
| **Deploy**   | Render (web service + PostgreSQL)                     |

## Current State

### What's Built & Working (Production)

- **Authentication** - Azure AD login, role-based access
- **Cases** - Full CRUD, search, filters, case detail with tabs
- **Documents** - Folder management, PDF viewer, document preview
- **Mapă** - Court filing folders with numbered slots, ONRC integration
- **Email** - Microsoft Graph sync, folder support, case linking
- **Tasks** - Kanban board, calendar view, task creation
- **Time Tracking** - Time entries, timesheet export
- **Calendar** - Week/month views, event management
- **Settings** - Theme, billing rates, team management
- **Mobile** - Separate `/m/*` routes with mobile-optimized UI

### Active Work (feature/ui-redesign branch)

Linear-inspired UI redesign in progress:

- Dark theme with Linear design tokens
- Mobile-first responsive layouts
- Component consolidation (Button, Card, Input, etc.)
- Page-by-page migration (Dashboard, Cases, Tasks, etc.)
- Many pages in "Verifying" status - need visual review

Key OPS issues:

- **OPS-338**: Linear UI Adaptation Phase 2 (Epic)
- **OPS-356-370**: Individual page redesigns
- **OPS-298**: Mobile Home fresh build

### Backend Services

| Service                | Status      | Purpose                                   |
| ---------------------- | ----------- | ----------------------------------------- |
| `gateway`              | Active      | Main GraphQL API, all business logic      |
| `ai-service`           | Active      | Email classification, document generation |
| `document-service`     | Placeholder | Future: dedicated doc processing          |
| `integration-service`  | Placeholder | Future: external integrations             |
| `notification-service` | Placeholder | Future: push notifications                |
| `task-service`         | Placeholder | Future: background jobs                   |

### What's Next

1. Complete Linear UI redesign (verify all pages)
2. Mobile UX polish
3. Enhanced AI assistant (chat interface)
4. Court deadline automation
5. Better email-to-case linking

---

_Last updated: 2025-01-03_
_Update this file as the project evolves._
