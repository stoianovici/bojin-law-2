# Research: FAB Visibility & Contextual Behavior

**Status**: Complete
**Date**: 2026-01-01
**Input**: `brainstorm-fab-visibility.md`
**Next step**: `/plan research-fab-visibility`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management mobile UI
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand
**Design system**: Superhuman-inspired dark theme

**Key decision from brainstorm**:

- Change FAB from pill shape (with "Nou" text) to circular icon-only (~56px)
- Hide FAB on search page, detail pages, and when sheets are open
- Show FAB only on main tab sections (Home, Cases, Calendar)
- Add contextual pre-selection based on current page
- Add inline "Add Task" button on case detail page

---

## Problem Statement

The FAB currently appears everywhere and always shows "+ Nou" label. It needs to:

1. Be hidden during creation flows
2. Only visible on main tab sections
3. Be contextual (different behavior per page)
4. Use inline actions on detail pages instead

---

## Research Findings

### 1. FAB Implementation Analysis

**Current location**: `src/components/layout/CreateFAB.tsx`

**Current design**:

- Pill-shaped with text: `[ + Nou ]`
- Position: `fixed bottom-24 left-1/2 -translate-x-1/2 z-40`
- Styling: `px-7 py-3.5 rounded-full`
- Background: `bg-mobile-text-primary` (light on dark)
- Shadow: `shadow-lg shadow-black/40`

**Current API**:

- **No props** - completely self-contained
- Uses Zustand: `const { setShowCreateSheet } = useUIStore()`
- Always rendered in mobile layout (no visibility control)

**Key code** (`CreateFAB.tsx`):

```tsx
export function CreateFAB() {
  const { setShowCreateSheet } = useUIStore();
  return (
    <button
      onClick={() => setShowCreateSheet(true)}
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-2 px-7 py-3.5 rounded-full',
        'bg-mobile-text-primary text-mobile-bg-primary',
        ...
      )}
    >
      <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
      Nou
    </button>
  );
}
```

**Rendered in** (`src/app/m/layout.tsx`):

```tsx
<CreateFAB />        {/* Always shown - no conditional */}
<BottomTabBar />
<CreateSheet />
```

---

### 2. CreateSheet Analysis

**Location**: `src/components/layout/CreateSheet.tsx`

**Supported creation types**:
| ID | Label | Route | Contexts |
|----|-------|-------|----------|
| `case` | Dosar Nou | `/m/cases/new` | `/m/cases`, `/m` |
| `task` | Task Nou | `/m/tasks/new` | `/m` |
| `event` | Eveniment | `/m/calendar/new` | `/m/calendar` |
| `note` | Notă | `/m/notes/new` | `/m/cases/` |

**Context-aware behavior already exists**:

- `getContextActions(pathname)` reorders actions based on current route
- Highlights most relevant action with "Sugerat pentru pagina curentă"
- Uses route prefix matching

**Pre-selection support**: **None currently**

- No `defaultType` prop
- Always shows all 4 options
- Would need to add prop or extend store

**State management**:

- Open/close via Zustand: `showCreateSheet` boolean
- Not persisted to localStorage

---

### 3. State Management Architecture

**7 Zustand stores found** in `src/store/`:

| Store            | Key State                                | Relevant to FAB               |
| ---------------- | ---------------------------------------- | ----------------------------- |
| `uiStore`        | `showCreateSheet`, `contextPanelVisible` | Yes - add FAB visibility here |
| `authStore`      | `user`, `isAuthenticated`                | No                            |
| `tasksStore`     | `viewMode`, filters                      | No                            |
| `casesStore`     | `viewMode`, filters                      | No                            |
| `calendarStore`  | `currentDate`, `view`                    | No                            |
| `documentsStore` | `viewMode`, `activeTab`                  | No                            |
| `emailStore`     | `isComposeOpen`                          | No                            |

**uiStore current interface**:

```typescript
interface UIState {
  showCreateSheet: boolean;
  setShowCreateSheet: (show: boolean) => void;
  sidebarCollapsed: boolean;
  contextPanelVisible: boolean;
  // ... others
}
```

**Existing route-based patterns**:

1. `BottomTabBar` uses `usePathname()` for active tab (stateless)
2. `CreateSheet` uses `usePathname()` for context actions
3. No existing visibility toggle pattern for components

---

### 4. Case Detail Page Analysis

**Location**: `src/app/m/cases/[id]/page.tsx`

**Current structure**:

- Header with back button and title
- Case info section (type, client, responsible)
- Tab navigation (Taskuri, Documente, Note, Istoric)
- Two task sections: "Taskuri deschise" and "Finalizate"
- **Fixed bottom action bar** with "Task nou" button

**Inline add button**: **Not present**

- Only has fixed bottom bar (lines 337-342)
- Full-width white button with Plus icon
- No inline button within task sections

**Recommended placement for inline add**:

- After the "Taskuri deschise" section (around line 266)
- Before the "Finalizate" section starts (line 269)
- Style: inline text button, not floating

---

### 5. Mockup Analysis

**FAB in mockups** (`mockups/superhuman-mobile.html`):

- Pill-shaped: `border-radius: 100px`
- Size: `padding: 14px 28px`
- Position: `bottom: 100px` (similar to current `bottom-24`)
- Content: Icon + "Nou" text
- **No circular FAB mockup exists**

**Bottom action button** (`mockups/case-detail.html`):

- Full-width: `width: 100%`
- Rounded rectangle: `border-radius: 10px`
- Content: Icon + "Task nou" text
- Already implemented in code

**Design tokens** (from mockups):

```
Backgrounds: #0a0a0a → #141414 → #1a1a1a
Text: #fafafa → #a1a1a1 → #6b6b6b
Accent: #3b82f6
Button shadow: 0 8px 30px rgba(0, 0, 0, 0.4)
```

---

## Patterns Discovered

### Route-Based Visibility (Recommended Pattern)

From `BottomTabBar.tsx` and `CreateSheet.tsx`:

```typescript
const pathname = usePathname();
const shouldShow = ['/m', '/m/cases', '/m/calendar'].some(
  (route) => pathname === route || pathname === route + '/'
);
```

### Zustand Store Extension Pattern

From `uiStore.ts`:

```typescript
// Add new state
showFAB: true,
setShowFAB: (show: boolean) => set({ showFAB: show }),

// Optionally combine with sheet state
setShowCreateSheet: (show: boolean, preSelectedType?: string) => set({
  showCreateSheet: show,
  createSheetPreSelectedType: preSelectedType ?? null,
}),
```

---

## Implementation Recommendation

### Approach: Route-Based Visibility in CreateFAB

The simplest approach that matches existing patterns:

1. **Modify CreateFAB** to check pathname and sheet state
2. **No store changes needed** for basic visibility
3. **Optional store enhancement** for pre-selection feature

```typescript
// In CreateFAB.tsx
const pathname = usePathname();
const { showCreateSheet } = useUIStore();

const FAB_VISIBLE_ROUTES = ['/m', '/m/cases', '/m/calendar'];
const shouldShow = FAB_VISIBLE_ROUTES.some((route) => pathname === route) && !showCreateSheet;

if (!shouldShow) return null;
```

### For Contextual Pre-Selection

Extend uiStore:

```typescript
interface UIState {
  showCreateSheet: boolean;
  createSheetDefaultType: 'case' | 'task' | 'event' | 'note' | null;
  setShowCreateSheet: (show: boolean, defaultType?: string | null) => void;
}
```

---

## File Plan

| File                                    | Action | Purpose                                            |
| --------------------------------------- | ------ | -------------------------------------------------- |
| `src/components/layout/CreateFAB.tsx`   | Modify | Add visibility logic, change to circular icon-only |
| `src/store/uiStore.ts`                  | Modify | Add `createSheetDefaultType` state (optional)      |
| `src/components/layout/CreateSheet.tsx` | Modify | Support `defaultType` for pre-selection (optional) |
| `src/app/m/cases/[id]/page.tsx`         | Modify | Add inline "Add Task" button in tasks section      |

---

## Risks

1. **No circular FAB mockup** - The brainstorm decided on circular, but mockups show pill. Need design confirmation or proceed with circular as decided.

2. **Pre-selection complexity** - Adding `defaultType` to CreateSheet requires:
   - Store changes
   - Component prop changes
   - Auto-scroll or highlight logic

3. **Route matching edge cases** - `/m/cases` vs `/m/cases/` trailing slash handling already addressed in existing code patterns.

4. **Bottom bar overlap** - Case detail already has bottom action bar. Adding inline button may create redundancy - consider if both are needed.

---

## Open Questions Resolved

| Question                                       | Answer                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| How is FAB currently implemented?              | Self-contained component, no visibility control, always rendered |
| Is visibility controllable?                    | Not currently, but easy to add with pathname check               |
| How does CreateSheet work?                     | 4 action types, context-aware ordering, no pre-selection         |
| What state management exists?                  | Zustand `uiStore` with `showCreateSheet` boolean                 |
| What does case detail tasks section look like? | Two collapsible sections + fixed bottom action bar               |
| Are there mockups for circular FAB?            | No - only pill-shaped FAB in mockups                             |

---

## Next Step

Start a new session and run:

```
/plan research-fab-visibility
```
