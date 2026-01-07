# Research: Mobile App Implementation

**Status**: Complete
**Date**: 2024-12-30
**Input**: `brainstorm-mobile-app.md`
**Next step**: `/plan research-mobile-app`

---

## Context Summary

**Project**: bojin-law-ui - Mobile-first legal case management web app
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client 4 (GraphQL), Radix UI
**Backend**: GraphQL gateway at `bojin-law-2` monorepo (`localhost:4000/graphql`)
**Language**: Romanian (`lang="ro"`)
**Target**: Mobile-first PWA with Superhuman-inspired dark UI

---

## Problem Statement

Build a mobile-first web app for legal case management following Superhuman-inspired mockups. The app needs:

1. Mobile-optimized UI with bottom tab navigation
2. Page transitions for app-like feel
3. PWA support for installation and offline capability
4. Integration with existing GraphQL backend

---

## Research Findings

### 1. GraphQL Schema Analysis

**Schema Location**: `/Users/mio/Developer/bojin-law-2/services/gateway/src/graphql/schema/`
**Total Files**: 48 GraphQL schema files

#### Existing Types (Ready for Mobile)

| Entity           | File                   | Key Fields                                                           |
| ---------------- | ---------------------- | -------------------------------------------------------------------- |
| **Case**         | `case.graphql`         | id, caseNumber, title, client, status, type, teamMembers, emailLinks |
| **Task**         | `task.graphql`         | id, title, dueDate, dueTime, status, priority, assignee, subtasks    |
| **Email**        | `email.graphql`        | id, subject, from, bodyPreview, receivedDateTime, caseLinks          |
| **Document**     | `document.graphql`     | id, fileName, fileType, uploadedAt, downloadUrl                      |
| **User**         | `case.graphql`         | id, email, firstName, lastName, role                                 |
| **BriefItem**    | `brief.graphql`        | Activity feed for mobile home (OPS-298)                              |
| **Notification** | `notification.graphql` | Push notification types defined                                      |

#### Calendar/Schedule Types (Partial)

- `TeamCalendarView` - Team-wide workload calendar
- `UserAvailability` - Out-of-office, vacation tracking
- `CalendarTask` - Tasks with dates for calendar display

#### Types Needed for Mobile

| Missing Type           | Purpose                                 | Priority |
| ---------------------- | --------------------------------------- | -------- |
| Personal CalendarEvent | Individual calendar (not team workload) | High     |
| User Profile/Me Query  | Profile picture, preferences, timezone  | High     |
| Favorites/Bookmarks    | Quick access to starred cases           | Medium   |
| Offline SyncMetadata   | Conflict resolution for offline edits   | Medium   |
| Rich Notifications     | Push payload with images, deeplinks     | Low      |

#### Schema Patterns

- **Extension pattern**: `extend type Query {}` in each domain file
- **Shared scalars**: DateTime, Date, UUID, JSON in `scalars.graphql`
- **Input types**: Colocated with entities (CreateCaseInput, UpdateTaskInput)
- **Authorization**: `@requiresFinancialAccess` directive on sensitive fields

---

### 2. Existing Code Analysis

#### Reusable Components

| Component  | Path                               | Reuse for Mobile     |
| ---------- | ---------------------------------- | -------------------- |
| Dialog     | `src/components/ui/Dialog.tsx`     | Base for BottomSheet |
| Tabs       | `src/components/ui/Tabs.tsx`       | Tab bar navigation   |
| Avatar     | `src/components/ui/Avatar.tsx`     | User indicators      |
| Badge      | `src/components/ui/Badge.tsx`      | Notification counts  |
| ScrollArea | `src/components/ui/ScrollArea.tsx` | Content scrolling    |
| Popover    | `src/components/ui/Popover.tsx`    | Quick actions        |

#### Layout Components

| Component      | Path                                       | Notes                      |
| -------------- | ------------------------------------------ | -------------------------- |
| AppShell       | `src/components/layout/AppShell.tsx`       | Needs mobile adaptation    |
| Sidebar        | `src/components/layout/Sidebar.tsx`        | navItems reusable for tabs |
| Header         | `src/components/layout/Header.tsx`         | Has FAB logic              |
| CommandPalette | `src/components/layout/CommandPalette.tsx` | Search functionality       |

#### State Management (Zustand)

| Store         | Path                         | Mobile Use                  |
| ------------- | ---------------------------- | --------------------------- |
| uiStore       | `src/store/uiStore.ts`       | Extend for bottom nav state |
| casesStore    | `src/store/casesStore.ts`    | View preferences            |
| tasksStore    | `src/store/tasksStore.ts`    | Task filtering              |
| calendarStore | `src/store/calendarStore.ts` | Calendar view state         |

#### Existing Animations (Tailwind)

```javascript
// Already configured in tailwind.config.js:
fadeIn: '200ms ease-out';
fadeOut: '150ms ease-in';
fadeInUp: '200ms ease-out with translate';
scaleIn: '200ms ease-out';
slideInRight: '300ms ease-out'; // Mobile-friendly
slideOutRight: '200ms ease-in';
```

---

### 3. Design Tokens from Mockups

#### Color Palette (Superhuman Dark Theme)

| Token              | Value                 | Usage                  |
| ------------------ | --------------------- | ---------------------- |
| `--bg-primary`     | #0a0a0a               | Main background        |
| `--bg-elevated`    | #141414               | Tab bar, sheets        |
| `--bg-card`        | #1a1a1a               | Card backgrounds       |
| `--bg-hover`       | #242424               | Hover states           |
| `--bg-overlay`     | rgba(0,0,0,0.6)       | Modal overlays         |
| `--text-primary`   | #fafafa               | Primary text           |
| `--text-secondary` | #a1a1a1               | Secondary text         |
| `--text-tertiary`  | #6b6b6b               | Labels, hints          |
| `--border`         | #2a2a2a               | Standard borders       |
| `--border-subtle`  | #1f1f1f               | Subtle dividers        |
| `--accent`         | #3b82f6               | Primary actions (blue) |
| `--accent-subtle`  | rgba(59,130,246,0.15) | Accent backgrounds     |
| `--warning`        | #f59e0b               | Urgent indicators      |
| `--warning-subtle` | rgba(245,158,11,0.15) | Warning backgrounds    |
| `--success`        | #22c55e               | Completed states       |

#### Spacing Scale

| Token         | Value |
| ------------- | ----- |
| `--space-xs`  | 4px   |
| `--space-sm`  | 8px   |
| `--space-md`  | 12px  |
| `--space-lg`  | 16px  |
| `--space-xl`  | 24px  |
| `--space-2xl` | 32px  |
| `--space-3xl` | 48px  |

#### Typography

- **Font**: System stack (-apple-system, SF Pro, Segoe UI)
- **Heading sizes**: 26px (main), 22px (page), 17px (section)
- **Body sizes**: 15-16px (primary), 13-14px (secondary)
- **Labels**: 10-11px (uppercase, spaced)

#### Border Radius Scale

| Use           | Value |
| ------------- | ----- |
| Buttons/tabs  | 8px   |
| Cards         | 10px  |
| Icons         | 12px  |
| Bottom sheets | 20px  |
| Phone bezel   | 40px  |
| Pills/FAB     | 100px |

---

### 4. Component Patterns from Mockups

#### Bottom Tab Bar

```
Position: fixed bottom, z-index 100
Height: ~64px (includes safe area)
Background: --bg-elevated
Tab: Icon (22px) + Label (10px)
Active: --text-primary, inactive: --text-tertiary
Safe area: pb-safe (iOS bottom)
```

#### List Item Pattern

```
Layout: Icon (40px) + Content + Arrow (16px)
Padding: 16px horizontal
Divider: 1px --border-subtle (except last)
Hover: --bg-elevated background
Touch target: Full width
```

#### Card Pattern

```
Background: --bg-card
Border: 1px --border or colored left border (3px)
Padding: --space-lg
Border-radius: 10px
Icon container: 36-44px, rounded 10-12px
```

#### Bottom Sheet

```
Overlay: --bg-overlay, z-index 50
Sheet: position absolute bottom, z-index 100
Border-radius: 20px top
Handle: 36x4px gray bar
Header: 11px uppercase tertiary
Action items: 44px icon containers
```

#### FAB (Floating Action Button)

```
Position: fixed, bottom 100px (above tab bar)
Style: pill-shaped (100px radius)
Background: --text-primary
Text: --bg-primary
Padding: 14px 28px
Hover: scale(1.05)
```

---

### 5. Page Transitions Recommendation

#### Recommended Approach: CSS + View Transitions API

**Immediate (Phase 1)**: Use existing Tailwind animations

```tsx
// Apply to page wrappers:
<div className="animate-fadeIn">  {/* Standard pages */}
<div className="animate-slideInRight">  {/* Drill-down pages */}
```

**Future (Phase 2)**: Enable View Transitions API

```javascript
// next.config.js
experimental: {
  viewTransition: true;
}
```

**Avoid**: Framer Motion for page transitions (App Router unmounting issues, 30-40KB bundle)

#### Animation Guidelines

- Keep durations 200-300ms for mobile
- Use GPU-accelerated properties only (transform, opacity)
- Add `prefers-reduced-motion` support
- Test on actual mobile devices

---

### 6. PWA Setup Recommendation

#### Current State: No PWA infrastructure

#### Recommended Approach: Native Next.js + Serwist

**Phase 1: Basic PWA**

1. Create `app/manifest.ts` (dynamic manifest)
2. Create `public/icons/` with maskable icons (192x192, 512x512)
3. Update `layout.tsx` with PWA metadata + iOS tags
4. Test installation on Chrome/Safari

**Phase 2: Offline Support**

1. Install Serwist: `npm install serwist @serwist/next`
2. Create `app/sw.ts` service worker
3. Cache strategies:
   - Cache-first: Static assets, UI shell
   - Stale-while-revalidate: Documents
   - Network-first: Case data, tasks

**iOS Considerations**

- 50MB cache limit (prioritize critical documents)
- No install prompt (create custom install UI)
- Required meta tags:
  ```html
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  ```

---

### 7. Navigation Architecture

#### Route Structure

```
src/app/
├── (mobile)/                    # Mobile route group
│   ├── layout.tsx              # Mobile layout with BottomTabBar
│   ├── page.tsx                # Home/Acasa
│   ├── cases/
│   │   ├── page.tsx            # Cases list/Dosare
│   │   └── [id]/page.tsx       # Case detail
│   ├── calendar/page.tsx       # Calendar
│   └── search/page.tsx         # Search
├── (dashboard)/                 # Desktop route group (existing)
└── layout.tsx                  # Root layout
```

#### New Components Needed

| Component    | Path                                 | Purpose                 |
| ------------ | ------------------------------------ | ----------------------- |
| BottomTabBar | `components/layout/BottomTabBar.tsx` | Fixed bottom navigation |
| BottomSheet  | `components/ui/BottomSheet.tsx`      | Modal from bottom       |
| CreateSheet  | `components/layout/CreateSheet.tsx`  | FAB quick actions       |
| MobileHeader | `components/layout/MobileHeader.tsx` | Simplified header       |

#### State Extensions (uiStore.ts)

```typescript
activeBottomTab: 'acasa' | 'dosare' | 'calendar' | 'cauta';
showCreateSheet: boolean;
```

---

## Implementation Recommendation

### Approach: Separate Mobile Route Group

Create a dedicated `(mobile)` route group with mobile-optimized layouts while preserving existing desktop UI. Use device detection or responsive breakpoints to route users appropriately.

### Why This Approach

1. **No desktop regression**: Existing UI unchanged
2. **Optimized bundles**: Mobile-specific code isolated
3. **Easier testing**: Clear separation of concerns
4. **Progressive enhancement**: Can share components between both

---

## File Plan

| File                                     | Action | Purpose                               |
| ---------------------------------------- | ------ | ------------------------------------- |
| `src/app/(mobile)/layout.tsx`            | Create | Mobile layout with BottomTabBar       |
| `src/app/(mobile)/page.tsx`              | Create | Home dashboard                        |
| `src/app/(mobile)/cases/page.tsx`        | Create | Cases list                            |
| `src/app/(mobile)/cases/[id]/page.tsx`   | Create | Case detail                           |
| `src/app/(mobile)/calendar/page.tsx`     | Create | Calendar view                         |
| `src/app/(mobile)/search/page.tsx`       | Create | Search page                           |
| `src/components/layout/BottomTabBar.tsx` | Create | Bottom navigation                     |
| `src/components/ui/BottomSheet.tsx`      | Create | Bottom modal                          |
| `src/components/layout/CreateSheet.tsx`  | Create | FAB actions sheet                     |
| `src/components/layout/MobileHeader.tsx` | Create | Mobile header                         |
| `src/app/globals.css`                    | Modify | Add Superhuman design tokens          |
| `tailwind.config.js`                     | Modify | Add slideInUp/slideOutDown animations |
| `src/store/uiStore.ts`                   | Modify | Add mobile navigation state           |
| `src/app/manifest.ts`                    | Create | PWA manifest                          |
| `public/icons/`                          | Create | PWA icons (192, 512, maskable)        |

---

## Risks

| Risk                            | Impact                           | Mitigation                                    |
| ------------------------------- | -------------------------------- | --------------------------------------------- |
| iOS 50MB cache limit            | Offline document access limited  | Prioritize recent/starred cases only          |
| No personal calendar in backend | Calendar view incomplete         | Extend GraphQL schema or use task dates       |
| Design token migration          | Could affect existing desktop UI | Scope tokens to mobile route group            |
| View Transitions API stability  | Browser support incomplete       | Use CSS animations as fallback                |
| Offline sync conflicts          | Data loss potential              | Implement timestamp-based conflict resolution |

---

## Constraints Found

1. **Backend**: No personal calendar events (only team workload)
2. **PWA**: iOS Safari has 50MB cache limit, no install prompt
3. **Animations**: Framer Motion causes App Router issues
4. **Existing UI**: Desktop-first design, needs mobile adaptation not replacement

---

## Next Step

Start a new session and run:

```
/plan research-mobile-app
```
