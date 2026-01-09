# [OPS-298] Mobile Home - Fresh Build

## State

**Phase 4 COMPLETE**. Mobile home is fully functional with all polish features.

### What's Working

- `useIsMobile()` hook detects mobile viewport (< 768px)
- `MobileHome` renders on mobile, desktop dashboards render on larger screens
- `MobileHeader` with hamburger menu and search button
- `MobileDrawer` with role-based navigation, user info, logout
- `BriefFeed` displays real email data from GraphQL backend
- `BriefCard` shows email type, sender, subject, and relative time
- AssistantBar quick action buttons navigate to tasks or open assistant
- AI chat input opens assistant on submit

### Phase 4 Polish (NEW)

- **Touch gestures**: Swipe from left edge to open drawer, swipe left to close
- **Pull-to-refresh**: Pull down at top of BriefFeed to refresh data
- **Animations**:
  - Staggered entrance for BriefFeed cards (framer-motion)
  - Spring animation for drawer open/close
  - Card tap feedback (scale, shadow)
- **Empty state**: Already implemented - shows message when no activity
- **Loading states**: Skeleton cards during initial load

## Done This Session (Dec 27, 2025)

### Touch Gestures

1. Created `useSwipeGesture.ts` hook for horizontal swipe detection
2. Created `useEdgeSwipe` convenience hook for left-edge swipe detection
3. Integrated edge swipe in MobileHome to open drawer
4. Integrated swipe-left in MobileDrawer (backdrop + drawer) to close

### Pull-to-Refresh

1. Created `usePullToRefresh.ts` hook with pull state management
2. Added `PullIndicator` component with rotating arrow and spinner
3. Integrated into BriefFeed with visual feedback during pull

### Animations

1. Updated MobileDrawer to use framer-motion `AnimatePresence`
2. Added spring animation for drawer slide (damping: 30, stiffness: 300)
3. Added backdrop fade animation
4. Wrapped BriefFeed items in `StaggerChildren`/`StaggerItem` for entrance animation

## Key Files

### New Hooks

- `apps/web/src/hooks/useSwipeGesture.ts` - swipe gesture detection
- `apps/web/src/hooks/usePullToRefresh.ts` - pull-to-refresh state

### Updated Components

- `apps/web/src/components/mobile/MobileHome.tsx` - edge swipe integration
- `apps/web/src/components/mobile/MobileDrawer.tsx` - framer-motion animations, swipe-to-close
- `apps/web/src/components/mobile/BriefFeed.tsx` - pull-to-refresh, stagger animations

### Existing Motion Components (reused)

- `apps/web/src/components/motion/StaggerChildren.tsx`

## Testing

Use Chrome DevTools mobile viewport:

- 390x844 (iPhone 14 Pro)
- Verify MobileHome renders < 768px
- Test drawer open/close via hamburger and swipe gestures
- Test pull-to-refresh by pulling down at top of feed
- Verify staggered card entrance animation on page load

## Status

**READY FOR VERIFICATION** - All Phase 4 polish items implemented:

- [x] Touch gestures (swipe to open/close drawer)
- [x] Pull-to-refresh on BriefFeed
- [x] Animations/transitions for cards and drawer
- [x] Empty state when no recent activity (was already done)
- [x] Loading states with skeletons (was already done)

Issue can be closed after verification on real mobile device.
