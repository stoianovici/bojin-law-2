# Mobile Implementation Checklist

> Use this checklist when implementing mobile UI. Check off items as completed.

## 1. Foundation Setup

### Design Tokens

- [ ] Add mobile-specific tokens to `tailwind.config.js`
  - [ ] Safe area CSS variables
  - [ ] Mobile font sizes (16px base)
  - [ ] Touch target sizes (44px, 48px, 52px)

- [ ] Create mobile breakpoint utilities

  ```js
  screens: {
    'mobile': { max: '767px' },
    'tablet': { min: '768px', max: '1023px' },
    'desktop': { min: '1024px' }
  }
  ```

- [ ] Add safe area support
  ```css
  :root {
    --safe-area-top: env(safe-area-inset-top);
    --safe-area-bottom: env(safe-area-inset-bottom);
  }
  ```

### Base Components

- [ ] Create `MobileLayout` wrapper component
  - [ ] Safe area padding
  - [ ] Bottom nav spacing
  - [ ] Viewport meta tags

- [ ] Create `BottomNav` component
  - [ ] 5 tabs (Home, Cases, Tasks, Docs, Messages)
  - [ ] Active state styling
  - [ ] Badge support
  - [ ] Safe area bottom padding

- [ ] Create `MobileHeader` component
  - [ ] Title prop
  - [ ] Back button variant
  - [ ] Action buttons slot
  - [ ] Safe area top padding

- [ ] Create `BottomSheet` component
  - [ ] Drag handle
  - [ ] Header with title + close
  - [ ] Scrollable body
  - [ ] Footer slot
  - [ ] Backdrop
  - [ ] Slide-up animation

---

## 2. Component Adaptations

### Buttons

- [ ] Update button base styles for mobile
  - [ ] `min-height: 48px` for primary/secondary
  - [ ] `padding: 14px 20px`
  - [ ] `font-size: 16px`
  - [ ] `:active` states (not `:hover`)

- [ ] Create `IconButton` mobile variant
  - [ ] 44×44px touch target
  - [ ] 24px icon size

- [ ] Create `FAB` (Floating Action Button) component
  - [ ] Fixed position
  - [ ] 56×56px size
  - [ ] Bottom-right placement
  - [ ] Bottom nav + safe area offset

### Form Inputs

- [ ] Update input base styles
  - [ ] `min-height: 52px`
  - [ ] `padding: 14px 16px`
  - [ ] `font-size: 16px` (prevents iOS zoom)
  - [ ] `border-radius: 12px`

- [ ] Create mobile-optimized select
  - [ ] Native select on mobile
  - [ ] Custom chevron icon
  - [ ] Full-width

- [ ] Create mobile checkbox with large touch area
  - [ ] 44×44px touch target
  - [ ] 24×24px visual checkbox

### Cards

- [ ] Create `MobileCaseCard` component
  - [ ] Stacked layout (not row)
  - [ ] Status dot + case number
  - [ ] Title + client
  - [ ] Date/age

- [ ] Create `MobileTaskItem` component
  - [ ] Checkbox with large touch area
  - [ ] Priority bar
  - [ ] Title + meta
  - [ ] Due date
  - [ ] Swipe actions support

- [ ] Create `MobileDocumentCard` component
  - [ ] Thumbnail with type badge
  - [ ] Filename + size
  - [ ] 2-column grid ready

### Lists

- [ ] Create `SwipeableListItem` component
  - [ ] Left swipe → right actions
  - [ ] Right swipe → left actions
  - [ ] Threshold detection
  - [ ] Snap back animation

- [ ] Create `CollapsibleSection` mobile variant
  - [ ] 44px touch target for header
  - [ ] Smooth expand/collapse animation
  - [ ] Count badge support

### Navigation

- [ ] Create `FilterPills` component
  - [ ] Horizontal scroll
  - [ ] Active state
  - [ ] Touch-friendly sizing

- [ ] Create `TabBar` component
  - [ ] Horizontal scroll for many tabs
  - [ ] Active indicator
  - [ ] Badge support

---

## 3. Page Implementations

### Home (`/`)

- [ ] Create `MobileHome` component
  - [ ] Greeting header with notification
  - [ ] Briefing card with stats
  - [ ] Quick actions grid (scrollable)
  - [ ] Urgent tasks widget
  - [ ] Active cases widget

- [ ] Implement pull-to-refresh
- [ ] Implement skeleton loading

### Cases List (`/cases`)

- [ ] Create `MobileCasesList` component
  - [ ] Header with search + menu
  - [ ] Filter pills (status)
  - [ ] Case card list

- [ ] Implement search expansion
- [ ] Implement swipe-to-archive
- [ ] Implement pull-to-refresh
- [ ] Implement empty state

### Case Detail (`/cases/[id]`)

- [ ] Create `MobileCaseDetail` component
  - [ ] Header with back + actions
  - [ ] Tab bar (scrollable)
  - [ ] Tab content switching

- [ ] Details tab
- [ ] Documents tab (2-col grid)
- [ ] Time entries tab (grouped list)
- [ ] Messages tab
- [ ] Activity tab

### Tasks (`/tasks`)

- [ ] Create `MobileTasksList` component
  - [ ] Header with search + menu
  - [ ] Filter pills
  - [ ] Collapsible sections (Urgent, This Week, Done)

- [ ] Implement task completion (checkbox)
- [ ] Implement swipe actions (complete/delete)
- [ ] Create task detail sheet
- [ ] Create new task sheet
- [ ] Implement pull-to-refresh

### Documents (`/documents`)

- [ ] Create `MobileDocuments` component
  - [ ] Header
  - [ ] Status toggle (Draft/Review/Final)
  - [ ] Period sections (collapsible)
  - [ ] 2-column document grid

- [ ] Create document preview (full screen)
  - [ ] Header with back + actions
  - [ ] Pinch-to-zoom
  - [ ] Page navigation
  - [ ] Action bar (share, download, etc.)

- [ ] Create upload sheet
  - [ ] Camera option
  - [ ] File picker
  - [ ] Case selector

### Communications (`/communications`)

- [ ] Create `MobileCommunications` component
  - [ ] Header with sync button
  - [ ] View filter pills
  - [ ] Email list

- [ ] Create email detail (full page)
  - [ ] Header with nav arrows
  - [ ] Sender info
  - [ ] Attachments section
  - [ ] Email body
  - [ ] Action bar (reply, forward)

- [ ] Create compose (full screen)
  - [ ] Form fields
  - [ ] AI draft button
  - [ ] Attachment upload

### Calendar (`/calendar`)

- [ ] Create `MobileCalendar` component
  - [ ] View toggle (week/agenda)
  - [ ] Week navigation
  - [ ] Day headers
  - [ ] Time grid (week) or date sections (agenda)
  - [ ] Event cards

- [ ] Create event detail sheet
- [ ] Create new event sheet
- [ ] Create filter sheet
- [ ] Implement week swipe navigation

---

## 4. Interactions

### Gestures

- [ ] Implement pull-to-refresh hook/component
  - [ ] Visual indicator
  - [ ] Threshold detection
  - [ ] Loading state

- [ ] Implement swipe actions hook
  - [ ] Direction detection
  - [ ] Threshold handling
  - [ ] Action trigger

- [ ] Implement long-press detection
  - [ ] Timeout management
  - [ ] Haptic feedback

- [ ] Implement edge swipe for back navigation
  - [ ] iOS-style gesture
  - [ ] Edge zone detection

### Feedback

- [ ] Add `:active` states to all interactive elements
- [ ] Add haptic feedback for key actions (if supported)
- [ ] Ensure all tap feedback is immediate (< 100ms)

---

## 5. States

### Loading

- [ ] Create skeleton components
  - [ ] Skeleton text
  - [ ] Skeleton card
  - [ ] Skeleton list item
  - [ ] Shimmer animation

- [ ] Create spinner component
  - [ ] Sizes: sm (16px), md (32px), lg (48px)
  - [ ] With optional text

### Empty

- [ ] Create empty state component
  - [ ] Icon slot
  - [ ] Title
  - [ ] Description
  - [ ] CTA button (optional)

- [ ] Create empty states for each page type
  - [ ] Cases
  - [ ] Tasks
  - [ ] Documents
  - [ ] Communications
  - [ ] Calendar

### Error

- [ ] Create error state component
  - [ ] Icon
  - [ ] Message
  - [ ] Retry button

- [ ] Create toast/notification component
  - [ ] Success/error/warning variants
  - [ ] Auto-dismiss
  - [ ] Manual close

---

## 6. Accessibility

### Touch

- [ ] Verify all touch targets ≥ 44px
- [ ] Verify adequate spacing between targets (≥ 8px)

### Screen Readers

- [ ] Add `aria-label` to icon-only buttons
- [ ] Add `role="alert"` to error states
- [ ] Add proper heading hierarchy
- [ ] Test with VoiceOver/TalkBack

### Motion

- [ ] Add `prefers-reduced-motion` support
- [ ] Provide alternative for gesture-based actions

---

## 7. Testing

### Device Testing

- [ ] Test on iPhone SE (small viewport)
- [ ] Test on iPhone 14 Pro Max (large viewport, notch)
- [ ] Test on Android device
- [ ] Test on tablet (iPad)

### Orientation

- [ ] Verify portrait layout works
- [ ] Decide on landscape support (optional)

### Performance

- [ ] Verify 60fps scrolling
- [ ] Verify gesture response time < 100ms
- [ ] Test with slow network (loading states)

---

## 8. Documentation

- [ ] Update component storybook with mobile variants
- [ ] Document mobile-specific props
- [ ] Create mobile design QA checklist

---

## Priority Order

1. **Foundation**: Tokens, MobileLayout, BottomNav, MobileHeader, BottomSheet
2. **Core Components**: Buttons, inputs, cards, lists
3. **Home Page**: First visible page
4. **Cases**: Most used feature
5. **Tasks**: Second most used
6. **Documents**: Medium priority
7. **Communications**: Complex, medium priority
8. **Calendar**: Lower priority
9. **Polish**: Animations, gestures, edge cases
