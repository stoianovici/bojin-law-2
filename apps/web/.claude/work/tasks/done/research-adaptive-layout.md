# Research: Adaptive Layout System

**Status**: Complete
**Date**: 2025-12-31
**Input**: `brainstorm-adaptive-layout.md`
**Next step**: `/plan research-adaptive-layout`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand, Radix UI
**Design system**: Linear-inspired dark theme

**Implementation Goals**:

1. **Contextual Panel System** - 320px right panel that appears when sidebar collapsed, showing page-specific content or activity feed
2. **Cases Page Rebuild** - Superhuman-style master-detail layout per mockup `mockups/03-cases-superhuman.html`

---

## Problem Statement

When the sidebar collapses (~176px freed), the content simply stretches without providing additional value. We need:

1. A contextual panel that appears when space is available
2. A Superhuman-style cases page that inherently uses all available space

---

## Research Findings

### Existing Code Analysis

#### Reusable Components & Patterns

| Component                  | Location                                    | Reusability                       |
| -------------------------- | ------------------------------------------- | --------------------------------- |
| `TaskDrawer`               | `src/components/tasks/TaskDrawer.tsx`       | Template for panel structure      |
| `CaseDrawer`               | `src/components/cases/CaseDrawer.tsx`       | Template for case detail panel    |
| `TeamActivityFeed`         | `src/components/tasks/TeamActivityFeed.tsx` | Direct import for activity feed   |
| `Tabs` (underline variant) | `src/components/ui/Tabs.tsx`                | Ready for case detail tabs        |
| `ScrollArea`               | `src/components/ui/ScrollArea.tsx`          | For scrollable panels             |
| `CaseCard`                 | `src/components/cases/CaseCard.tsx`         | Grid view (may not need)          |
| `CaseRow`                  | `src/components/cases/CaseRow.tsx`          | List view (adapt for master list) |

#### Layout Structure (AppShell)

Current structure in `src/components/layout/AppShell.tsx`:

```tsx
<div className="flex h-screen bg-linear-bg-primary">
  <aside
    className={cn('flex-shrink-0 transition-all duration-200', sidebarCollapsed ? 'w-16' : 'w-60')}
  >
    {sidebar}
  </aside>
  <div className="flex flex-1 flex-col overflow-hidden">
    <header>...</header>
    <main className="flex flex-1 min-h-0 overflow-hidden">{children}</main>
  </div>
</div>
```

**Key insight**: Sidebar uses `flex-shrink-0` + fixed width. Right panel should mirror this pattern.

#### Selection State Pattern

Selection is managed via Zustand stores (NOT URL params):

```typescript
// casesStore.ts
selectedCaseId: string | null;
selectCase: (caseId: string | null) =>
  void (
    // Toggle behavior
    selectCase(selectedCaseId === caseId ? null : caseId)
  );
```

#### Right Panel Pattern (Currently 380px)

Both Tasks and Cases pages use identical pattern:

```tsx
{
  selectedCase && (
    <aside className="w-[380px] bg-linear-bg-secondary border-l border-linear-border-subtle flex flex-col">
      <CaseDrawer caseData={selectedCase} onClose={handleCloseDrawer} />
    </aside>
  );
}
```

### Patterns Discovered

#### Animation Patterns (No Framer Motion!)

Custom Tailwind animations defined in `tailwind.config.js`:

- `animate-slideInRight` (300ms) - Perfect for panel entrance
- `animate-slideOutRight` (200ms) - Panel exit
- `animate-fadeIn/fadeOut` (200ms)
- Standard: `transition-all duration-200` for width changes

#### Panel/Drawer Pattern

Common structure across TaskDrawer and CaseDrawer:

```tsx
<div className="flex h-full flex-col">
  {/* Header with border */}
  <div className="flex items-center justify-between border-b border-linear-border-subtle px-4 py-4">
    {/* Action buttons using: h-8 w-8 rounded-md border... */}
  </div>

  {/* Scrollable content */}
  <ScrollArea className="flex-1">
    <div className="p-5">{/* Sections with consistent spacing */}</div>
  </ScrollArea>
</div>
```

#### Filter Button Pattern

```tsx
<button className={cn(
  'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border',
  hasFilters
    ? 'bg-linear-accent/15 border-linear-accent text-linear-accent'  // Active
    : 'bg-transparent border-linear-border-subtle text-linear-text-secondary hover:text-linear-text-primary'
)}>
```

### Mockup Analysis: `mockups/03-cases-superhuman.html`

#### Exact Dimensions

| Element           | Width              |
| ----------------- | ------------------ |
| Sidebar           | 56px               |
| Case List Panel   | 400px              |
| Case Detail Panel | flex-1 (remaining) |

#### Color Tokens (CSS → Tailwind mapping)

| Variable           | Value                   | Notes               |
| ------------------ | ----------------------- | ------------------- |
| `--bg-base`        | `#0D0D0D`               | Primary background  |
| `--bg-surface`     | `#141414`               | Panel backgrounds   |
| `--bg-elevated`    | `#1A1A1A`               | Elevated elements   |
| `--bg-hover`       | `#222222`               | Hover states        |
| `--bg-selected`    | `#2A2A2A`               | Selected items      |
| `--text-primary`   | `#FAFAFA`               | Primary text        |
| `--text-secondary` | `#A0A0A0`               | Secondary text      |
| `--text-tertiary`  | `#666666`               | Muted text          |
| `--accent`         | `#6366F1`               | Accent (indigo-500) |
| `--accent-soft`    | `rgba(99,102,241,0.15)` | Accent background   |
| `--success`        | `#22C55E`               | Status: active      |
| `--warning`        | `#F59E0B`               | Status: pending     |

#### Typography Scale

| Element            | Size | Weight          |
| ------------------ | ---- | --------------- |
| Case list title    | 16px | 600             |
| Case number (mono) | 12px | 400             |
| Case title (list)  | 14px | 500             |
| Case client        | 13px | 400             |
| Tags               | 11px | 400             |
| Detail title       | 24px | 600             |
| Detail meta        | 14px | 400             |
| Tab text           | 13px | 500             |
| Section title      | 11px | 600 (uppercase) |
| Info label         | 12px | 400             |
| Info value         | 14px | 400             |

#### Case List Item Structure

```
.case-item (py-4 px-6, border-b, cursor-pointer)
├── Header row (flex, gap-3, mb-2)
│   ├── Status dot (8px, rounded-full)
│   ├── Case number (12px, mono, accent)
│   └── Date (12px, tertiary, ml-auto)
├── Title (14px, font-medium, mb-1)
├── Client (13px, tertiary)
└── Tags row (flex, gap-2, mt-2.5)
    └── Tag × N (11px, px-2 py-0.5, rounded)
```

#### Interactive States

- **Selected item**: `bg-selected`, `border-l-2 border-accent`
- **Hover item**: `bg-hover`
- **Active filter**: `bg-accent/15 border-accent text-accent`
- **Active tab**: `text-primary`, `border-b-2 border-accent`

#### Keyboard Shortcuts Footer

```
Position: fixed bottom-6 right-6
Style: bg-elevated, border border-default, rounded-xl, px-5 py-4
Hints: J (Next), K (Prev), Enter (Open), N (New), Cmd+K (Commands)
```

### Dependencies & Constraints

#### Available Libraries

| Library             | Status        | Usage             |
| ------------------- | ------------- | ----------------- |
| Radix UI Tabs       | ✅ Installed  | Case detail tabs  |
| Radix UI ScrollArea | ✅ Installed  | Scrollable panels |
| Radix UI Dialog     | ✅ Installed  | Modals            |
| Tailwind animations | ✅ Configured | Panel transitions |
| Zustand persist     | ✅ Configured | State persistence |

#### NOT Available (may need to add)

| Library            | Recommendation                               |
| ------------------ | -------------------------------------------- |
| Virtual scrolling  | Add `@tanstack/react-virtual` if >1000 cases |
| Framer Motion      | NOT needed - Tailwind animations sufficient  |
| useMediaQuery hook | NOT needed - use Tailwind classes            |

#### Keyboard Handling Pattern

Existing in `src/hooks/useCommandPalette.ts`:

```typescript
const handler = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
};
window.addEventListener('keydown', handler);
```

Follow this pattern for J/K/N/Enter navigation.

### Constraints Found

1. **No responsive breakpoint hook** - Use Tailwind classes (`hidden md:block`) for responsive behavior
2. **380px drawer width** - Current standard; mockup uses 400px for case list
3. **Selection in Zustand** - Must continue this pattern (not URL params)
4. **Animation only via Tailwind** - No Framer Motion, use existing keyframes

---

## Implementation Recommendation

### Part 1: Contextual Panel System

**Approach**: Extend uiStore + modify AppShell

1. **Add state to uiStore**:

```typescript
interface UIState {
  // ... existing
  contextPanelVisible: boolean; // User preference
  setContextPanelVisible: (visible: boolean) => void;
}
// Persist contextPanelVisible in partialize
```

2. **Panel visibility logic**:

```typescript
const showContextPanel = sidebarCollapsed && contextPanelVisible && !pageHasOwnPanel; // Cases page has master-detail, skip
```

3. **AppShell modification**:

```tsx
<main className="flex flex-1 min-h-0 overflow-hidden">
  {children}
  {showContextPanel && (
    <aside className="w-80 flex-shrink-0 border-l animate-slideInRight">
      <ContextPanel />
    </aside>
  )}
</main>
```

4. **ContextPanel component**:

- Header with close button
- Default: `<TeamActivityFeed />` (already exists!)
- Per-page: Allow pages to override via context/prop

### Part 2: Cases Page Rebuild

**Approach**: New layout matching mockup exactly

**Layout Structure**:

```tsx
<div className="flex flex-1 overflow-hidden">
  {/* Case List Panel - 400px */}
  <div className="w-[400px] flex-shrink-0 border-r flex flex-col">
    <CaseListHeader /> {/* Title, search, filters */}
    <ScrollArea className="flex-1">
      <CaseListItems /> {/* Virtualized if needed */}
    </ScrollArea>
  </div>

  {/* Case Detail Panel - flex-1 */}
  <div className="flex-1 flex flex-col overflow-hidden">
    {selectedCase ? (
      <>
        <CaseDetailHeader /> {/* Title, meta, actions */}
        <CaseDetailTabs /> {/* Detalii | Documente | Sarcini | Email | Pontaj */}
        <ScrollArea className="flex-1">
          <CaseDetailContent />
        </ScrollArea>
      </>
    ) : (
      <EmptyState />
    )}
  </div>
</div>;

{
  /* Keyboard hints - fixed position */
}
<KeyboardHintsFooter />;
```

**Keyboard Navigation Hook**:

```typescript
// useKeyboardNavigation.ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'j':
        selectNextCase();
        break;
      case 'k':
        selectPrevCase();
        break;
      case 'Enter':
        focusDetail();
        break;
      case 'n':
        openNewCaseDialog();
        break;
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

---

## File Plan

| File                                           | Action  | Purpose                             |
| ---------------------------------------------- | ------- | ----------------------------------- |
| `src/store/uiStore.ts`                         | Modify  | Add contextPanelVisible state       |
| `src/components/layout/AppShell.tsx`           | Modify  | Add conditional right panel slot    |
| `src/components/layout/ContextPanel.tsx`       | Create  | Contextual panel wrapper            |
| `src/app/(dashboard)/cases/page.tsx`           | Rebuild | Superhuman-style master-detail      |
| `src/components/cases/CaseListPanel.tsx`       | Create  | 400px case list with search/filters |
| `src/components/cases/CaseListItem.tsx`        | Create  | Individual case row matching mockup |
| `src/components/cases/CaseDetailPanel.tsx`     | Create  | Full detail view with tabs          |
| `src/components/cases/CaseDetailTabs.tsx`      | Create  | Tab content components              |
| `src/components/cases/KeyboardHintsFooter.tsx` | Create  | Fixed keyboard shortcut hints       |
| `src/hooks/useCaseKeyboardNav.ts`              | Create  | J/K/Enter/N keyboard handling       |

---

## Risks

| Risk                                          | Mitigation                                              |
| --------------------------------------------- | ------------------------------------------------------- |
| Large case list performance                   | Use virtual scrolling if >500 cases observed            |
| Sidebar transition + panel animation conflict | Use `transition-all duration-200` consistently          |
| Keyboard shortcuts conflicting with inputs    | Disable when focus is in input/textarea                 |
| Mobile breakpoint handling                    | Cases page already desktop-only; mobile has separate UI |

---

## Next Step

Start a new session and run:

```
/plan research-adaptive-layout
```
