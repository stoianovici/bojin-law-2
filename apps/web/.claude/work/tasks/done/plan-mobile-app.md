# Plan: Mobile App Implementation

**Status**: Approved
**Date**: 2024-12-30
**Input**: `research-mobile-app.md`
**Next step**: `/implement plan-mobile-app`

---

## Context Summary

**Project**: bojin-law-ui - Mobile-first legal case management web app
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Apollo Client 4 (GraphQL), Radix UI
**Backend**: GraphQL gateway at `localhost:4000/graphql`
**Language**: Romanian (`lang="ro"`)

## Approach Summary

Create a dedicated `(mobile)` route group with Superhuman-inspired dark UI. Build mobile-specific components (BottomTabBar, BottomSheet, MobileHeader) and pages (Home, Cases, Calendar, Search) while preserving the existing desktop UI. Add PWA support with manifest and icons. Use CSS animations for page transitions (avoid Framer Motion).

---

## Parallel Group 1: Foundation

> These tasks run simultaneously via sub-agents

### Task 1.1: Add Superhuman Design Tokens

- **File**: `src/app/globals.css` (MODIFY)
- **Do**: Add CSS custom properties for mobile theme under a `.mobile` or `[data-mobile]` scope:
  - Background: `--bg-primary: #0a0a0a`, `--bg-elevated: #141414`, `--bg-card: #1a1a1a`, `--bg-hover: #242424`, `--bg-overlay: rgba(0,0,0,0.6)`
  - Text: `--text-primary: #fafafa`, `--text-secondary: #a1a1a1`, `--text-tertiary: #6b6b6b`
  - Border: `--border: #2a2a2a`, `--border-subtle: #1f1f1f`
  - Accent: `--accent: #3b82f6`, `--accent-subtle: rgba(59,130,246,0.15)`
  - Status: `--warning: #f59e0b`, `--warning-subtle: rgba(245,158,11,0.15)`, `--success: #22c55e`
  - Spacing: `--space-xs` through `--space-3xl` (4px to 48px)
  - Add safe area padding utilities: `pb-safe`, `pt-safe`
- **Done when**: Design tokens are defined and scoped to mobile routes

### Task 1.2: Add Mobile Animations

- **File**: `tailwind.config.js` (MODIFY)
- **Do**: Add these keyframes and animations:
  - `slideInUp`: translateY(100%) to translateY(0), 300ms ease-out
  - `slideOutDown`: translateY(0) to translateY(100%), 200ms ease-in
  - `slideInFromBottom`: for bottom sheet entrance
  - `fadeInScale`: opacity 0 + scale(0.95) to opacity 1 + scale(1)
- **Done when**: New animations are available as Tailwind classes (`animate-slideInUp`, etc.)

### Task 1.3: Add Mobile Navigation State

- **File**: `src/store/uiStore.ts` (MODIFY)
- **Do**: Add to the store:
  ```typescript
  activeBottomTab: 'acasa' | 'dosare' | 'calendar' | 'cauta'
  setActiveBottomTab: (tab: 'acasa' | 'dosare' | 'calendar' | 'cauta') => void
  showCreateSheet: boolean
  setShowCreateSheet: (show: boolean) => void
  ```
- **Done when**: Mobile navigation state is available in Zustand store

### Task 1.4: Create PWA Manifest

- **File**: `src/app/manifest.ts` (CREATE)
- **Do**: Create dynamic manifest with:
  - `name`: "Bojin Law"
  - `short_name`: "Bojin"
  - `description`: "Legal case management"
  - `start_url`: "/"
  - `display`: "standalone"
  - `background_color`: "#0a0a0a"
  - `theme_color`: "#0a0a0a"
  - `icons`: Array with 192x192 and 512x512 (include maskable)
- **Done when**: Manifest exports MetadataRoute.Manifest function

### Task 1.5: Create PWA Icons

- **File**: `public/icons/` (CREATE directory and files)
- **Do**: Create placeholder SVG icons:
  - `icon-192.png` - 192x192 app icon
  - `icon-512.png` - 512x512 app icon
  - `icon-maskable-512.png` - 512x512 maskable icon
  - Use a simple "BL" monogram on dark background (#0a0a0a)
  - Note: These are placeholders; real icons should be designed later
- **Done when**: Icons exist in public/icons/ directory

---

## Parallel Group 2: Core Components

> These tasks run simultaneously via sub-agents

### Task 2.1: Create BottomTabBar Component

- **File**: `src/components/layout/BottomTabBar.tsx` (CREATE)
- **Do**: Create fixed bottom navigation with:
  - 4 tabs: Acasa (Home), Dosare (Briefcase), Calendar, Cauta (Search)
  - Icons: Use Lucide icons (Home, Briefcase, Calendar, Search)
  - Active state: `--text-primary`, inactive: `--text-tertiary`
  - Height: 64px + safe area padding bottom
  - Background: `--bg-elevated` with top border
  - Use `usePathname()` to determine active tab
  - Use `Link` from next/link for navigation
  - Routes: `/`, `/cases`, `/calendar`, `/search`
- **Done when**: Component renders 4 tabs with active state highlighting

### Task 2.2: Create BottomSheet Component

- **File**: `src/components/ui/BottomSheet.tsx` (CREATE)
- **Do**: Create reusable bottom sheet modal:
  - Props: `open`, `onClose`, `title?`, `children`
  - Overlay: fixed inset-0, `--bg-overlay`, z-50
  - Sheet: fixed bottom-0, `--bg-elevated`, rounded-t-[20px], z-100
  - Handle bar: 36x4px centered gray bar at top
  - Animation: `animate-slideInUp` on enter
  - Close on overlay click and swipe down (basic, no gesture library)
  - Use Radix Dialog primitive as base if helpful
- **Done when**: Component opens/closes with animation and overlay

### Task 2.3: Create MobileHeader Component

- **File**: `src/components/layout/MobileHeader.tsx` (CREATE)
- **Do**: Create simplified mobile header:
  - Props: `title`, `showBack?`, `rightAction?`
  - Height: 56px + safe area padding top
  - Background: `--bg-primary` or transparent
  - Back button: Left chevron icon when `showBack` is true
  - Title: Centered, 17px semibold
  - Right slot: Optional action button/icon
- **Done when**: Component renders header with optional back button

### Task 2.4: Create CreateSheet Component

- **File**: `src/components/layout/CreateSheet.tsx` (CREATE)
- **Do**: Create FAB action sheet for quick create:
  - Uses BottomSheet component
  - Header: "CREAZA" (11px uppercase tertiary)
  - Actions list with 44px icon containers:
    - Dosar Nou (New Case) - Briefcase icon
    - Task Nou (New Task) - CheckSquare icon
    - Eveniment (Event) - Calendar icon
    - Document (Document) - FileText icon
  - Each action: icon (36px container, rounded-xl) + label
  - Connect to uiStore `showCreateSheet` state
- **Done when**: Sheet displays 4 create options with icons

---

## Parallel Group 3: Mobile Pages

> These tasks run simultaneously via sub-agents

### Task 3.1: Create Mobile Layout

- **File**: `src/app/(mobile)/layout.tsx` (CREATE)
- **Do**: Create mobile route group layout:
  - Import and render BottomTabBar at bottom
  - Add `data-mobile` attribute to wrapper for CSS scoping
  - Main content area with padding-bottom for tab bar (64px + safe)
  - Add PWA meta tags to head:
    - `apple-mobile-web-app-capable`: "yes"
    - `apple-mobile-web-app-status-bar-style`: "black-translucent"
    - viewport with `viewport-fit=cover`
  - Background: `--bg-primary`
  - Include CreateSheet component (triggered by FAB)
- **Done when**: Layout renders with bottom tab bar and proper spacing

### Task 3.2: Create Home Page (Acasa)

- **File**: `src/app/(mobile)/page.tsx` (CREATE)
- **Do**: Create home dashboard page:
  - MobileHeader with title "Acasa"
  - FAB button: Fixed position, bottom 100px, right 16px
    - Style: pill-shaped, `--text-primary` bg, `--bg-primary` text
    - Label: "+ Nou" or just "+"
    - onClick: `setShowCreateSheet(true)`
  - Content sections (placeholder data for now):
    - "Astazi" (Today) section with task cards
    - "Recent" section with recent cases
  - Use `animate-fadeIn` for page entrance
  - Scroll area for content
- **Done when**: Page renders with header, FAB, and placeholder sections

### Task 3.3: Create Cases List Page (Dosare)

- **File**: `src/app/(mobile)/cases/page.tsx` (CREATE)
- **Do**: Create cases list page:
  - MobileHeader with title "Dosare"
  - Search bar at top (visual only, links to /search)
  - Filter chips: "Toate", "Active", "Urgente"
  - Case list items following List Item Pattern:
    - Icon (40px colored container) + Content + Arrow
    - Content: Case number, title, client name, status badge
    - Colored left border based on case type
  - Use placeholder/mock data for now
  - Empty state if no cases
- **Done when**: Page renders case list with proper styling

### Task 3.4: Create Calendar Page

- **File**: `src/app/(mobile)/calendar/page.tsx` (CREATE)
- **Do**: Create calendar view page:
  - MobileHeader with title "Calendar"
  - Date selector at top (today + scrollable dates)
  - Events/tasks list for selected date
  - Event card pattern:
    - Time on left
    - Title + case reference
    - Color indicator for type
  - Use placeholder data
  - Note: Real data requires backend calendar query
- **Done when**: Page renders with date selector and event list

### Task 3.5: Create Search Page (Cauta)

- **File**: `src/app/(mobile)/search/page.tsx` (CREATE)
- **Do**: Create search page:
  - MobileHeader with title "Cauta"
  - Large search input at top (auto-focus)
  - Recent searches section (placeholder)
  - Search results area (placeholder)
  - Categories: Dosare, Taskuri, Documente
  - Can integrate with existing CommandPalette logic later
- **Done when**: Page renders with search input and placeholder sections

---

## Sequential: After Group 3

### Task 4: Create Case Detail Page

- **Depends on**: Task 3.1 (layout), Task 3.3 (cases list patterns)
- **File**: `src/app/(mobile)/cases/[id]/page.tsx` (CREATE)
- **Do**: Create case detail page:
  - MobileHeader with back button, case number as title
  - Case header card:
    - Case title, client name
    - Status badge, type indicator
    - Team member avatars
  - Tab sections (segmented control):
    - "Detalii" - Case details
    - "Taskuri" - Related tasks
    - "Documente" - Documents
    - "Emails" - Linked emails
  - Each section with appropriate list styling
  - Quick actions at bottom or in header
  - Use placeholder data, prepare for GraphQL integration
- **Done when**: Page renders case details with tabbed sections

---

## Final Steps (Sequential)

### Task 5: Integration & Testing

- **Depends on**: All previous tasks
- **Do**:
  1. Verify all mobile routes work (/, /cases, /cases/[id], /calendar, /search)
  2. Test tab navigation highlights correct tab
  3. Test FAB opens CreateSheet
  4. Test BottomSheet animations
  5. Verify PWA manifest loads (`/manifest.webmanifest`)
  6. Test on mobile viewport (375px width)
  7. Check safe area handling on iOS simulator
  8. Fix any TypeScript errors
  9. Run `npm run build` to ensure no build errors
- **Done when**: All routes functional, no build errors, PWA installable

---

## Session Scope Assessment

- **Total tasks**: 15
- **Estimated complexity**: Medium-Complex
- **Parallel groups**: 3 (5 + 4 + 5 tasks)
- **Sequential tasks**: 2
- **Checkpoint recommended at**: After Group 2 (core components complete)

## Key Patterns Reference

**List Item**: Icon (40px) + Content + Arrow, 16px padding, full-width touch target
**Card**: `--bg-card`, 1px border or 3px colored left border, 16px padding, 10px radius
**Bottom Sheet**: 20px top radius, 36x4px handle, 11px uppercase header
**FAB**: Fixed bottom 100px, pill shape, `--text-primary` bg

## File Ownership Map

| File                                     | Task |
| ---------------------------------------- | ---- |
| `src/app/globals.css`                    | 1.1  |
| `tailwind.config.js`                     | 1.2  |
| `src/store/uiStore.ts`                   | 1.3  |
| `src/app/manifest.ts`                    | 1.4  |
| `public/icons/*`                         | 1.5  |
| `src/components/layout/BottomTabBar.tsx` | 2.1  |
| `src/components/ui/BottomSheet.tsx`      | 2.2  |
| `src/components/layout/MobileHeader.tsx` | 2.3  |
| `src/components/layout/CreateSheet.tsx`  | 2.4  |
| `src/app/(mobile)/layout.tsx`            | 3.1  |
| `src/app/(mobile)/page.tsx`              | 3.2  |
| `src/app/(mobile)/cases/page.tsx`        | 3.3  |
| `src/app/(mobile)/calendar/page.tsx`     | 3.4  |
| `src/app/(mobile)/search/page.tsx`       | 3.5  |
| `src/app/(mobile)/cases/[id]/page.tsx`   | 4    |

---

## Next Step

Start a new session and run:

```
/implement plan-mobile-app
```
