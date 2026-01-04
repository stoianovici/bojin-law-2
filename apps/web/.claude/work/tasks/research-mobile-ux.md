# Research: Mobile UX

**Status**: Complete
**Date**: 2024-12-29
**Input**: `brainstorm-mobile-ux.md`
**Next step**: `/plan research-mobile-ux`

---

## Context Summary

- **Project Path**: `/Users/mio/Developer/bojin-law-ui`
- **Tech Stack**: Next.js 16 (App Router), TypeScript 5.3+, Tailwind CSS 3.4, Zustand, Apollo Client 4, Radix UI
- **Goal**: Mobile-first responsive web app for legal case management
- **Target**: Phones only (tablets deferred)
- **Core Pattern**: Linear mobile style with collapsible sections

---

## Problem Statement

Design mobile UX for the legal platform as a responsive web app. Mobile is for **information checking** with **quick actions close at hand**. Key features:

- Collapsible sections (Linear mobile style)
- Role-specific home views (Partner, Asociat, Asociat Jr)
- Quick actions via bottom sheet
- Swipe-to-complete for tasks
- Push notifications for assignments/mentions/deadlines

---

## Research Findings

### 1. Responsive Breakpoints & Tailwind Patterns

#### Current Configuration

- **File**: `/Users/mio/Developer/bojin-law-ui/tailwind.config.js`
- **Breakpoints**: Uses Tailwind CSS 3.4 defaults (no custom breakpoints)
  - `sm: 640px` - Small devices
  - `md: 768px` - Medium devices
  - `lg: 1024px` - Large devices
  - `xl: 1280px` - Extra large
  - `2xl: 1536px` - Extra extra large

#### Existing Responsive Patterns

| Pattern            | File                                          | Implementation                              |
| ------------------ | --------------------------------------------- | ------------------------------------------- |
| Grid responsive    | `src/app/(dashboard)/page.tsx:44`             | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |
| Sidebar visibility | `src/components/layout/AppShell.tsx:20-27`    | `hidden md:flex` with overlay               |
| Dialog sizing      | `src/components/layout/CommandPalette.tsx:60` | `sm:max-w-lg`                               |
| Text visibility    | `src/components/layout/Header.tsx:27`         | `hidden sm:inline`                          |

#### Recommended Breakpoint Strategy

```
Mobile (< 640px)   → Single-column, collapsed sections (accordion)
Tablet (sm: 640px) → 2-column layout, collapsible sections
Desktop (md: 768px)→ Full layout, expanded by default
```

#### State Management Pattern

- **File**: `src/store/uiStore.ts`
- Uses Zustand with `persist` middleware to localStorage
- Existing: `sidebarOpen`, `sidebarCollapsed`, `commandPaletteOpen`
- Recommendation: Extend with `expandedSections: string[]` for mobile

---

### 2. Bottom Sheet Components

#### Available Options

| Option       | Status        | Recommendation                                     |
| ------------ | ------------- | -------------------------------------------------- |
| Radix Dialog | Installed ✓   | **Not recommended** - designed for centered modals |
| Vaul         | Not installed | **Recommended** - purpose-built for bottom sheets  |
| Custom       | N/A           | Not recommended - high development effort          |

#### Why Vaul

- Purpose-built for mobile bottom sheets/drawers
- Small bundle (~4KB gzipped)
- Smooth animations (slide up/down)
- By Emil Kowalski (Vercel team)
- Integrates well with Radix UI + Tailwind

#### Installation

```bash
npm install vaul
```

#### Implementation Pattern

```typescript
import { Drawer } from 'vaul'

<Drawer.Root>
  <Drawer.Trigger>+ New</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="fixed bottom-0 left-0 right-0 rounded-t-xl bg-linear-bg-primary">
      {/* Quick action items */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

#### Existing Dialog Assets

- **File**: `src/components/ui/Dialog.tsx`
- Has animations: `fadeIn`, `fadeOut`, `scaleIn`
- Keep for centered modals, use Vaul for bottom sheets

---

### 3. Collapsible/Accordion Patterns

#### Current Status

- `@radix-ui/react-accordion` - **Not installed**
- `@radix-ui/react-collapsible` - **Not installed**

#### Available Animations

**File**: `tailwind.config.js`

```javascript
fadeIn: 'fadeIn 200ms ease-out';
fadeOut: 'fadeOut 150ms ease-in';
fadeInUp: 'fadeInUp 200ms ease-out';
scaleIn: 'scaleIn 200ms ease-out';
```

**Missing (add for collapsible)**:

```javascript
slideInUp: { from: 'translateY(100%)', to: 'translateY(0)' }
slideOutDown: { from: 'translateY(0)', to: 'translateY(100%)' }
```

#### Recommendation

Install `@radix-ui/react-collapsible` (lighter than accordion):

```bash
npm install @radix-ui/react-collapsible
```

#### Implementation Pattern

```typescript
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'

<Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
  <Collapsible.Trigger className="flex items-center justify-between w-full">
    <span>My Tasks (3 due today)</span>
    <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} />
  </Collapsible.Trigger>
  <Collapsible.Content className="overflow-hidden transition-all data-[state=open]:animate-fadeInUp data-[state=closed]:animate-fadeOut">
    {/* Section content */}
  </Collapsible.Content>
</Collapsible.Root>
```

#### State Management for Sections

**Option A: Local state (session-only)**

```typescript
const [expandedSections, setExpandedSections] = useState<string[]>(['tasks']);
```

**Option B: Persist to localStorage (recommended)**
Extend `uiStore.ts`:

```typescript
interface UIState {
  // ...existing
  expandedSections: string[];
  toggleSection: (sectionId: string) => void;
}
```

---

### 4. Swipe Gestures for Tasks

#### Current Status

- No gesture libraries installed
- Radix Toast has built-in swipe-to-dismiss (limited use case)

#### Library Comparison

| Feature        | React Swipeable | Framer Motion |
| -------------- | --------------- | ------------- |
| Bundle Size    | ~8KB            | ~50KB         |
| Learning Curve | Very Low        | Medium        |
| Touch + Mouse  | Yes             | Yes           |
| Animation      | Basic           | Excellent     |
| TypeScript     | Full            | Full          |

#### Recommendation: React Swipeable

Best for your use case (swipe-to-complete):

```bash
npm install react-swipeable
```

#### Implementation Pattern

```typescript
import { useSwipeable } from 'react-swipeable'

function TaskItem({ task, onComplete }: Props) {
  const handlers = useSwipeable({
    onSwipedRight: () => onComplete(task.id),
    preventScrollOnSwipe: true,
    trackMouse: true,
    delta: 50, // minimum swipe distance
  })

  return (
    <div {...handlers} className="relative">
      {/* Swipe reveals green "Complete" background */}
      <Card className="relative z-10">
        <Checkbox /> {task.title}
      </Card>
    </div>
  )
}
```

#### Visual Feedback Pattern

```typescript
const [swipeProgress, setSwipeProgress] = useState(0)

const handlers = useSwipeable({
  onSwiping: ({ deltaX }) => setSwipeProgress(Math.min(deltaX / 100, 1)),
  onSwipedRight: () => { /* complete */ },
  onTouchEndOrOnMouseUp: () => setSwipeProgress(0),
})

// Style based on progress
<div style={{ transform: `translateX(${swipeProgress * 50}px)` }}>
```

---

### 5. Push Notifications

#### Current Status

- **In-app toasts**: `src/components/ui/Toast.tsx` (Radix-based)
- **Service worker**: None
- **Push libraries**: None installed
- **PWA config**: None

#### Service Comparison

| Aspect         | Firebase FCM     | OneSignal            | Native Web Push     |
| -------------- | ---------------- | -------------------- | ------------------- |
| Pricing        | Free tier        | No free tier         | Infrastructure only |
| Setup          | Medium           | Easy                 | Complex             |
| Reliability    | ~99%             | 99.95%+              | Depends             |
| Vendor Lock-in | Yes              | Yes                  | No                  |
| Best For       | Google ecosystem | Marketing/automation | Full control        |

#### Recommendation: Native Web Push + VAPID

For a legal app wanting full control:

1. No vendor dependency
2. Works with your GraphQL backend
3. Can add OneSignal/FCM later if needed

#### Next.js 16 Considerations

- Turbopack is default bundler
- Most PWA libraries require webpack
- Use `--webpack` flag for dev/build until Turbopack support added

#### Implementation Roadmap

**Phase 1: Service Worker Setup**

```bash
npm install web-push  # Server-side
```

**File Structure**:

```
public/
├── sw.js           # Service worker
├── manifest.json   # Web app manifest
└── icons/          # App icons

app/
└── layout.tsx      # Add manifest link
```

**Phase 2: Client Registration**
Create hook: `src/hooks/usePushNotifications.ts`

```typescript
export function usePushNotifications() {
  const subscribe = async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      // Send subscription to backend via GraphQL
    }
  };
  return { subscribe };
}
```

**Phase 3: Backend Integration**

```typescript
// GraphQL mutation
mutation SubscribeToPush($subscription: PushSubscriptionInput!) {
  subscribeToPushNotifications(subscription: $subscription)
}

// Send notifications from backend events
// - Task assignments
// - Mentions (@name)
// - Deadline reminders
// - New emails
```

---

## Implementation Recommendation

### Libraries to Install

```bash
# Required
npm install vaul                           # Bottom sheet
npm install @radix-ui/react-collapsible    # Collapsible sections
npm install react-swipeable                # Swipe gestures
npm install web-push                       # Push notifications (server)
```

### File Plan

| File                                     | Action | Purpose                               |
| ---------------------------------------- | ------ | ------------------------------------- |
| `src/components/ui/BottomSheet.tsx`      | Create | Vaul-based quick actions drawer       |
| `src/components/ui/Collapsible.tsx`      | Create | Radix Collapsible wrapper             |
| `src/components/ui/SwipeableCard.tsx`    | Create | Swipeable task item                   |
| `src/components/mobile/MobileHome.tsx`   | Create | Mobile home with collapsible sections |
| `src/components/mobile/MobileHeader.tsx` | Create | Mobile header with case scope         |
| `src/hooks/useSwipeTask.ts`              | Create | Swipe-to-complete hook                |
| `src/hooks/usePushNotifications.ts`      | Create | Push notification subscription        |
| `src/store/uiStore.ts`                   | Modify | Add `expandedSections` state          |
| `tailwind.config.js`                     | Modify | Add slideUp/slideDown animations      |
| `public/sw.js`                           | Create | Service worker for push               |
| `public/manifest.json`                   | Create | Web app manifest                      |

---

## Patterns Discovered

### Existing Codebase Patterns to Reuse

1. **Component structure**: CVA + Tailwind in `src/components/ui/`
2. **State management**: Zustand with persist in `src/store/`
3. **Hooks pattern**: Custom hooks in `src/hooks/`
4. **Animation classes**: Tailwind keyframes in `tailwind.config.js`
5. **Responsive**: Mobile-first with `md:` breakpoint for desktop

### Linear Design System Assets

- CSS variables: `--linear-bg-*`, `--linear-text-*`, `--linear-border-*`
- Spacing: `--linear-space-xs` to `--linear-space-2xl`
- Shadows: `--linear-shadow-*`
- Z-index scale: 50 (dropdown) to 150 (tooltip)

---

## Constraints Found

1. **Next.js 16 + Turbopack**: PWA libraries need `--webpack` flag
2. **No existing gesture code**: Clean slate for swipe implementation
3. **Radix limitations**: No bottom sheet primitive, need Vaul
4. **Mobile overlay**: Sidebar pattern exists, reuse for mobile menu

---

## Risks

| Risk                          | Mitigation                                             |
| ----------------------------- | ------------------------------------------------------ |
| Vaul bundle size              | Small (~4KB), acceptable                               |
| PWA webpack requirement       | Use `--webpack` flag, Turbopack support coming         |
| Swipe conflicts with scroll   | Use `preventScrollOnSwipe: true`, test on real devices |
| Push notification permissions | Graceful degradation, don't block app usage            |
| Offline handling              | Show cached content, disable actions, auto-retry       |

---

## Next Step

Start a new session and run:

```
/plan research-mobile-ux
```
