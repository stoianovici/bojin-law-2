# Brainstorm: Mobile App Implementation

**Status**: Complete
**Date**: 2024-12-30
**Next step**: `/research brainstorm-mobile-app`

---

## Context

**Project**: bojin-law-ui - New UI for Legal Platform V2
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client 4 (GraphQL), Radix UI
**Backend**: GraphQL gateway at `bojin-law-2` monorepo (`localhost:4000/graphql`)
**Language**: Romanian (`lang="ro"`)

**Mockups Location**: `/Users/mio/Developer/bojin-law-ui/mockups/`

- `superhuman-mobile.html` - Home/Dashboard
- `cases-tab.html` - Cases list
- `case-detail.html` - Case detail with tasks
- `calendar-tab.html` - Calendar view
- `search-tab.html` - Universal search
- `task-detail.html` - Task detail view
- `email-detail.html` - Email detail view
- `bottom-sheet.html` - Quick action modal

---

## Problem Statement

Build a mobile-first web app for legal case management following the Superhuman-inspired mockups. The app needs both frontend (Next.js) and backend (GraphQL API) work.

---

## Decisions

### 1. Platform

- **Mobile-responsive web app** (Next.js PWA)
- Not React Native or native mobile

### 2. Design System

- **Superhuman tokens** from mockups replace existing Linear tokens
- Key colors:
  - `--bg-primary: #0a0a0a`
  - `--bg-elevated: #141414`
  - `--bg-card: #1a1a1a`
  - `--text-primary: #fafafa`
  - `--text-secondary: #a1a1a1`
  - `--accent: #3b82f6`
  - `--warning: #f59e0b`
  - `--success: #22c55e`
- Font: System font stack (SF Pro / -apple-system)
- Spacing scale: 4px base (xs:4, sm:8, md:12, lg:16, xl:24, 2xl:32, 3xl:48)

### 3. Navigation Pattern

- **File-based routing with transitions**
- Routes: `/` (home), `/cases`, `/cases/[id]`, `/calendar`, `/search`
- Slide/fade animations between pages (Framer Motion)
- Bottom sheets for quick actions (FAB "Nou" button)
- Bottom tab bar for main navigation (Acasa, Dosare, Calendar, Cauta)

### 4. Implementation Priority

1. **Phase 1**: Home Dashboard + Bottom Tab Bar
2. **Phase 2**: Cases list + Case detail
3. **Phase 3**: Calendar view
4. **Phase 4**: Search
5. **Phase 5**: Task detail, Email detail, Bottom sheets

### 5. Backend

- Work on GraphQL API alongside frontend
- Located in `bojin-law-2` monorepo
- Needs schemas for: Cases, Tasks, Calendar Events, Emails, Users

---

## Rationale

- **Next.js PWA over native**: Faster development, single codebase, works on all devices
- **File-based routing**: Proper URLs for bookmarking/sharing (important for a professional tool), browser history works
- **Transitions**: Makes it feel app-like despite being web
- **Superhuman tokens**: The mockups are excellent and well-thought-out; using them as source of truth avoids inconsistency
- **Priority order**: Home is the entry point users see first; Cases are core functionality

---

## Open Questions for Research

- [ ] What's the current state of the GraphQL schema in bojin-law-2?
- [ ] What entities/types already exist vs need to be created?
- [ ] How should page transitions be implemented? (Framer Motion vs CSS vs Next.js built-in)
- [ ] PWA setup requirements (service worker, manifest, offline support)
- [ ] Bottom tab bar implementation pattern (shared layout vs component)
- [ ] State management approach for navigation/transitions

---

## Next Step

Start a new session and run:

```
/research brainstorm-mobile-app
```
