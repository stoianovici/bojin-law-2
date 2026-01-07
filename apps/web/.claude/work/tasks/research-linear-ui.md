# Research: Linear Design Best Practices & Implementation Polish

**Status**: Complete
**Date**: 2024-12-29
**Input**: `brainstorm-linear-ui.md`
**Next step**: `/plan research-linear-ui`

---

## Context Summary

- **Project**: `/Users/mio/Developer/bojin-law-ui`
- **Type**: Next.js 16 (App Router) legal case management UI
- **Tech Stack**: TypeScript, Tailwind CSS, Radix UI, Apollo Client, Zustand
- **Reference Codebase**: `/Users/mio/Developer/bojin-law-2`
- **Goal**: Polish existing Linear-inspired UI to match Linear's design standards

---

## Research Findings

### 1. Existing Code Analysis

#### Current Implementation (bojin-law-ui)

**Strengths - Already Linear-Like:**
| Component | Status | File Path |
|-----------|--------|-----------|
| Button | Complete | `/src/components/ui/Button.tsx` |
| Card | Complete | `/src/components/ui/Card.tsx` |
| Badge | Complete | `/src/components/ui/Badge.tsx` |
| Input/TextArea | Complete | `/src/components/ui/Input.tsx` |
| Avatar | Complete | `/src/components/ui/Avatar.tsx` |
| Dialog | Complete | `/src/components/ui/Dialog.tsx` |
| DropdownMenu | Complete | `/src/components/ui/DropdownMenu.tsx` |
| Tooltip | Complete | `/src/components/ui/Tooltip.tsx` |
| Toast | Complete | `/src/components/ui/Toast.tsx` |
| Popover | Complete | `/src/components/ui/Popover.tsx` |
| Select | Complete | `/src/components/ui/Select.tsx` |
| Tabs | Complete | `/src/components/ui/Tabs.tsx` |
| ScrollArea | Complete | `/src/components/ui/ScrollArea.tsx` |
| Separator | Complete | `/src/components/ui/Separator.tsx` |
| AppShell | Complete | `/src/components/layout/AppShell.tsx` |
| Sidebar | Complete | `/src/components/layout/Sidebar.tsx` |
| Header | Complete | `/src/components/layout/Header.tsx` |
| CommandPalette | Basic | `/src/components/layout/CommandPalette.tsx` |

**Design System Files:**

- `/tailwind.config.js` - Custom Linear design tokens
- `/src/app/globals.css` - CSS variables for light/dark themes
- `/src/lib/utils.ts` - `cn()` helper (clsx + tailwind-merge)

**Patterns Working Well:**

1. CVA (class-variance-authority) for all component variants
2. Semantic color tokens: `linear-bg-*`, `linear-text-*`, `linear-accent`
3. Consistent spacing: `linear-xs` (4px) to `linear-2xl` (32px)
4. Custom animations: `fadeIn`, `fadeOut`, `scaleIn`, `slideInRight`
5. Radix UI foundation with proper forwarded refs

**Areas Needing Improvement:**

| Gap                | Priority | Notes                                         |
| ------------------ | -------- | --------------------------------------------- |
| Command Palette    | High     | Replace custom implementation with `cmdk`     |
| Keyboard Shortcuts | High     | Add `react-hotkeys-hook` for global shortcuts |
| Missing Components | Medium   | Checkbox, Radio, Switch, Table, Pagination    |
| Animation Easing   | Medium   | Add spring-based animations (Framer Motion)   |
| Theme Polish       | Medium   | Align colors exactly with Linear's palette    |
| Icon System        | Low      | Centralized icon wrapper component            |

---

### 2. Linear Design System Analysis

#### Official Design System: "Orbiter"

- Built on **Radix UI Primitives** for accessibility
- Styled with **styled-components** (we use Tailwind - equivalent)
- Theme generation from only **3 variables**: base color, accent color, contrast

#### Linear's Color Palette

**Dark Theme (Primary):**

```css
--linear-bg-primary: #0d0d0f; /* Near-black background */
--linear-bg-secondary: #131316; /* Elevated surfaces */
--linear-bg-tertiary: #1a1a1f; /* Tertiary surfaces */
--linear-bg-hover: #1f1f24; /* Hover states */

--linear-border-default: rgba(255, 255, 255, 0.08);
--linear-border-subtle: rgba(255, 255, 255, 0.04);

--linear-text-primary: #f5f5f5;
--linear-text-secondary: #a0a0a0;
--linear-text-tertiary: #6b6b6b;

--linear-accent: #5e6ad2; /* Indigo - calm authority */
--linear-accent-hover: #6e7de0;
```

**Light Theme:**

```css
--linear-bg-primary: #ffffff;
--linear-bg-secondary: #f7f7f7;
--linear-bg-tertiary: #eeeeee;
--linear-bg-hover: #e5e5e5;

--linear-border-default: rgba(0, 0, 0, 0.08);
--linear-border-subtle: rgba(0, 0, 0, 0.04);

--linear-text-primary: #2f2f2f;
--linear-text-secondary: #6b6b6b;
--linear-text-tertiary: #9a9a9a;
```

**Current Implementation Comparison:**
| Token | Current | Linear | Action |
|-------|---------|--------|--------|
| `bg-primary` (dark) | #0A0A0B | #0d0d0f | Adjust slightly |
| `bg-secondary` (dark) | #111113 | #131316 | Adjust slightly |
| `accent` | #5E6AD2 | #5e6ad2 | Already correct |
| `text-primary` (dark) | #EEEFF1 | #f5f5f5 | Minor adjustment |
| `border-subtle` | rgba(255,255,255,0.06) | rgba(255,255,255,0.04) | Reduce opacity |

#### Typography System

```css
font-family:
  'Inter UI',
  'SF Pro Display',
  -apple-system,
  system-ui,
  sans-serif;

/* Heading: Inter Display for >32pt */
font-weight: 600;
letter-spacing: -0.02em;

/* Body: Inter regular */
font-weight: 400;
/* No letter-spacing adjustment for <18pt */
```

**Typography Scale:**
| Name | Size | Weight | Line Height |
|------|------|--------|-------------|
| xs | 11px | 400 | 1.25 |
| sm | 12px | 400 | 1.25 |
| base | 13px | 400 | 1.5 |
| lg | 14px | 400 | 1.5 |
| xl | 16px | 500 | 1.5 |
| 2xl | 20px | 600 | 1.25 |

#### Spacing System (4px base)

| Token | Value |
| ----- | ----- |
| xs    | 4px   |
| sm    | 8px   |
| md    | 12px  |
| lg    | 16px  |
| xl    | 24px  |
| 2xl   | 32px  |

#### Animation Guidelines

- **Micro-interactions**: 150-200ms
- **Page transitions**: 300-400ms
- **Modals/dialogs**: 200-300ms
- **Easing**: `easeOut` for enter, `easeIn` for exit
- **Spring animations** (Framer Motion):
  ```js
  { type: "spring", stiffness: 400, damping: 30 }
  ```

#### Shadow System

```css
--linear-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--linear-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
--linear-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);

/* Dark mode - deeper shadows */
--linear-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--linear-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
--linear-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
```

#### Glassmorphism Pattern (for overlays)

```css
.glass-overlay {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

### 3. Command Palette Best Practices

#### Recommended: `cmdk` Library

- **Used by**: Linear, Vercel, Raycast
- **GitHub**: [github.com/pacocoursey/cmdk](https://github.com/pacocoursey/cmdk)

**Installation:**

```bash
npm install cmdk
```

**Implementation Pattern:**

```tsx
import { Command } from 'cmdk';

function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <Command.Input placeholder="Type a command or search..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Navigation">
          <Command.Item onSelect={() => navigate('/inbox')}>
            <InboxIcon /> Go to Inbox
            <kbd>G I</kbd>
          </Command.Item>
        </Command.Group>
        <Command.Separator />
        <Command.Group heading="Actions">
          <Command.Item onSelect={() => createNew()}>
            <PlusIcon /> Create New
            <kbd>C</kbd>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**CSS Selectors for Styling:**

```css
[cmdk-root] {
  /* root container */
}
[cmdk-dialog] {
  /* dialog wrapper */
}
[cmdk-input] {
  /* search input */
}
[cmdk-list] {
  height: var(--cmdk-list-height);
  transition: height 100ms ease;
}
[cmdk-item] {
  /* individual items */
}
[cmdk-item][data-selected='true'] {
  /* highlighted item */
}
[cmdk-group-heading] {
  /* group title */
}
```

---

### 4. Keyboard Shortcuts Best Practices

#### Recommended: `react-hotkeys-hook`

- **GitHub**: [github.com/JohannesKlauss/react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)

**Installation:**

```bash
npm install react-hotkeys-hook
```

**Implementation Pattern:**

```tsx
import { useHotkeys, HotkeysProvider } from 'react-hotkeys-hook';

// Global shortcuts
function App() {
  // Cmd+K for command palette
  useHotkeys('mod+k', () => openCommandPalette());

  // Vim-style navigation: G then I for Inbox
  useHotkeys('g i', () => navigate('/inbox'), {
    splitKey: ' ',
    scopes: ['navigation'],
  });

  // Create shortcuts
  useHotkeys('c', () => openCreateModal());

  return (
    <HotkeysProvider>
      <AppContent />
    </HotkeysProvider>
  );
}
```

**Linear's Keyboard Patterns:**
| Pattern | Shortcut | Action |
|---------|----------|--------|
| Command | `Cmd/Ctrl + K` | Open command palette |
| Create | `C` | Create new item |
| Navigate | `G + I` | Go to Inbox |
| Navigate | `G + D` | Go to Documents |
| Navigate | `G + T` | Go to Tasks |
| Select | `X` | Select item |
| Escape | `Esc` | Close/clear |
| Help | `?` | Show shortcuts |
| Expand | `E` | Expand/fullscreen view |

---

### 5. Reference Codebase Patterns (bojin-law-2)

#### Authentication (Azure MSAL)

- **Config**: `/apps/web/src/lib/msal-config.ts`
- **Context**: `/apps/web/src/contexts/AuthContext.tsx`
- **Pattern**: MSAL + fallback session cookie

**Key Scopes:**

```ts
scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'Files.ReadWrite.All'];
```

#### GraphQL Schema Structure

- **Cases**: `/services/gateway/src/graphql/schema/case.graphql`
- **Documents**: `/services/gateway/src/graphql/schema/document.graphql`
- **Emails**: `/services/gateway/src/graphql/schema/email.graphql`
- **Tasks**: `/services/gateway/src/graphql/schema/task.graphql`
- **Time Entries**: `/services/gateway/src/graphql/schema/time-entry.graphql`

**Key Types:**

- `CaseStatus`: ACTIVE, ARCHIVED, ON_HOLD
- `TaskType`: Research, DocumentCreation, CourtDate, Meeting
- `TaskStatus`: Pending, InProgress, Completed, Cancelled
- `EmailClassificationState`: Pending, Classified, Uncertain, Ignored

#### State Management

- **Pattern**: Zustand stores
- **Location**: `/apps/web/src/stores/`
- **Examples**: `assistant.store.ts`, `documents.store.ts`, `task-management.store.ts`

#### Microsoft Integrations

- **OneDrive**: `/services/gateway/src/services/onedrive.service.ts`
- **SharePoint**: `/services/gateway/src/services/sharepoint.service.ts`
- **Outlook**: `/apps/web/src/utils/outlook.ts` (deep linking)

---

### 6. Open Source Linear Examples

#### linearapp_clone (tuan3w)

- **URL**: [github.com/tuan3w/linearapp_clone](https://github.com/tuan3w/linearapp_clone)
- **Stack**: React, TypeScript, Tailwind CSS
- **Stars**: 300+

#### linear-clone (thenameiswiiwin)

- **URL**: [github.com/thenameiswiiwin/linear-clone](https://github.com/thenameiswiiwin/linear-clone)
- **Stack**: Next.js 13, TypeScript, Tailwind, CVA
- **Pattern**: Same CVA + clsx pattern we use

#### Key Learnings

- Both use **CVA for variants** (same as our approach)
- Both use **Tailwind with CSS variables** for theming
- Command palette implementations vary in quality

---

### 7. Pre-built Theme Examples (linear.style)

| Theme           | Background | Accent  | Use Case             |
| --------------- | ---------- | ------- | -------------------- |
| **Midnight**    | #0F0F10    | #D25E65 | Dark with red accent |
| **Dawn**        | #2A222E    | #A84376 | Dark purple          |
| **Nord**        | #2E3440    | #88C0D0 | Nordic blue          |
| **GitHub Dark** | #06090f    | #238636 | GitHub style         |
| **Tokyo Night** | #17161F    | #61D0FF | Cyberpunk blue       |

---

## Implementation Recommendation

### Priority 1: Command Palette Upgrade

Replace current manual implementation with `cmdk` library for:

- Better search/filter performance
- Built-in keyboard navigation
- Consistent with Linear's actual implementation

**Files to modify:**

- `src/components/layout/CommandPalette.tsx` - Refactor to use cmdk
- `package.json` - Add cmdk dependency

### Priority 2: Keyboard Shortcuts System

Add `react-hotkeys-hook` for:

- Global shortcuts (Cmd+K, C, G+I, etc.)
- Scoped shortcuts (form inputs disabled)
- Consistent vim-style navigation

**Files to create:**

- `src/hooks/useKeyboardShortcuts.ts`
- `src/providers/KeyboardProvider.tsx`

### Priority 3: Theme Refinement

Adjust CSS variables to match Linear exactly:

```css
/* Dark theme adjustments in globals.css */
.dark {
  --linear-bg-primary: #0d0d0f; /* From #0A0A0B */
  --linear-bg-secondary: #131316; /* From #111113 */
  --linear-bg-tertiary: #1a1a1f; /* From #18181B */
  --linear-bg-hover: #1f1f24; /* From #232326 */
  --linear-border-subtle: rgba(255, 255, 255, 0.04); /* From 0.06 */
}
```

### Priority 4: Missing Components

Add these Radix-based components:

- `Checkbox.tsx` - With indeterminate state
- `Radio.tsx` - Radio group
- `Switch.tsx` - Toggle switch
- `Table.tsx` - Data table with sorting
- `Pagination.tsx` - For lists

### Priority 5: Animation Polish

Add Framer Motion for:

- Page transitions (300ms)
- Modal animations (spring-based)
- List item animations

---

## File Plan

| File                                       | Action | Purpose                                           |
| ------------------------------------------ | ------ | ------------------------------------------------- |
| `package.json`                             | Modify | Add `cmdk`, `react-hotkeys-hook`, `framer-motion` |
| `src/components/ui/Command.tsx`            | Create | cmdk-based command component                      |
| `src/components/layout/CommandPalette.tsx` | Modify | Use new Command component                         |
| `src/hooks/useKeyboardShortcuts.ts`        | Create | Global shortcuts hook                             |
| `src/providers/KeyboardProvider.tsx`       | Create | Hotkeys provider wrapper                          |
| `src/app/globals.css`                      | Modify | Adjust Linear color tokens                        |
| `tailwind.config.js`                       | Modify | Add spring animation easing                       |
| `src/components/ui/Checkbox.tsx`           | Create | Radix checkbox component                          |
| `src/components/ui/Switch.tsx`             | Create | Radix switch component                            |
| `src/components/ui/Table.tsx`              | Create | Data table component                              |

---

## Dependencies to Add

```bash
# Command palette (used by Linear)
npm install cmdk

# Keyboard shortcuts
npm install react-hotkeys-hook

# Animations (optional but recommended)
npm install framer-motion

# Additional Radix components
npm install @radix-ui/react-checkbox @radix-ui/react-switch
```

---

## Risks

1. **cmdk Migration** - Current command palette logic needs to be migrated
   - Mitigation: Preserve existing command definitions, only change UI layer

2. **Keyboard Shortcut Conflicts** - May conflict with browser/OS shortcuts
   - Mitigation: Use scopes, disable in text inputs

3. **Bundle Size** - Adding Framer Motion increases bundle
   - Mitigation: Tree-shake, only import needed features

4. **Theme Breaking Changes** - Color adjustments may affect existing UI
   - Mitigation: Test each section after changes

---

## Next Step

Start a new session and run:

```
/plan research-linear-ui
```
