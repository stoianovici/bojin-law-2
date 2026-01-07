# Command Palette Wiring - Investigation Report

## Current State

The command palette exists but is **partially implemented** in `apps/web`. The deployed app has a basic working version, but it's missing significant functionality compared to the design spec and the old implementation.

### What Works Now

| Feature                       | Status          | Location                                               |
| ----------------------------- | --------------- | ------------------------------------------------------ |
| ⌘K / Ctrl+K trigger           | Working         | `useCommandPalette.ts:74-84`                           |
| Search button in header       | Working         | `Header.tsx:109-120`                                   |
| Dialog modal opens            | Working         | `CommandPalette.tsx:50-98`                             |
| Search filtering              | Working (basic) | `useCommandPalette.ts:54-59`                           |
| Keyboard navigation (↑↓Enter) | Working         | `CommandPalette.tsx:28-47`                             |
| Navigation commands           | Working         | Routes to /, /cases, /documents, /tasks, /email, /time |

### What's Broken/Missing

| Feature                               | Status  | Impact                                          |
| ------------------------------------- | ------- | ----------------------------------------------- |
| Icons not rendered                    | Bug     | Commands show empty space where icons should be |
| Action commands missing               | Missing | No "New Case", "New Task", "Log Time", "Ask AI" |
| Grouped sections                      | Missing | No "Acțiuni Frecvente" / "Navigare" grouping    |
| Global shortcuts (⌘N, ⌘T, ⌘L, ⌘J, ⌘G) | Missing | Only ⌘K works                                   |
| Shortcut reference panel (⌘/)         | Missing | No way to see available shortcuts               |
| AI command with glow effect           | Missing | Design spec feature not implemented             |
| Keyword-based search                  | Missing | Only matches title, not keywords                |

## Root Cause Analysis

### 1. Incomplete Migration from `apps/web-old`

The old implementation in `apps/web-old` has a full-featured command palette:

```
apps/web-old/src/
├── components/layout/CommandPalette.tsx   # 470 lines - full implementation
├── components/linear/GlobalShortcuts.tsx  # Registers all shortcuts
├── components/linear/ShortcutReference.tsx
├── components/linear/ShortcutHint.tsx
├── hooks/useKeyboardShortcuts.ts          # Scope-based shortcut system
└── stores/navigation.store.ts             # Navigation state management
```

The new implementation in `apps/web` is simplified:

```
apps/web/src/
├── components/layout/CommandPalette.tsx   # 100 lines - basic
├── hooks/useCommandPalette.ts             # Basic navigation only
└── store/uiStore.ts                       # Zustand store (different from old)
```

### 2. Different State Management

- **Old**: Uses `useNavigationStore` (custom store with rich navigation state)
- **New**: Uses `useUIStore` (Zustand with `commandPaletteOpen` only)

### 3. Missing Icon Rendering

The current `CommandPalette.tsx` renders `{command.icon}` (line 86), but the commands in `useCommandPalette.ts` don't provide icon components - they have `icon?: React.ReactNode` but it's never populated.

### 4. Empty Action Callbacks

Current implementation has placeholder actions:

```typescript
// useCommandPalette.ts:15-27
const navigationCommands: Command[] = [
  { id: 'nav-home', title: 'Acasă', shortcut: 'G H', category: 'navigation', action: () => {} },
  // ... all actions are empty () => {}
];
```

The actions are later populated with router.push in the `commands` useMemo (lines 36-52), but this only covers navigation - there are no action commands.

## Implementation Plan

### Phase 1: Fix Current Implementation (Quick Wins)

1. **Add icons to navigation commands** (`useCommandPalette.ts`)
   - Import Lucide icons
   - Add icon property to each command

2. **Add action commands** (`useCommandPalette.ts`)
   - "Caz nou" (⌘N) - navigate to /cases/new
   - "Sarcină nouă" (⌘T) - open task form
   - "Înregistrare timp" (⌘L) - navigate to /time
   - "Întreabă AI" (⌘J) - open AI assistant (context panel)

3. **Add grouped sections** (`CommandPalette.tsx`)
   - Group commands by category: 'action' vs 'navigation'
   - Render section headers: "Acțiuni Frecvente" / "Navigare"

### Phase 2: Add Global Shortcuts

4. **Create `useKeyboardShortcuts.ts`** hook
   - Port from `apps/web-old/src/hooks/useKeyboardShortcuts.ts`
   - Adapt to use `useUIStore` instead of `useNavigationStore`

5. **Create `GlobalShortcuts.tsx`** component
   - Register all global shortcuts: ⌘K, ⌘N, ⌘T, ⌘L, ⌘J, ⌘G, Escape
   - Add to dashboard layout

6. **Add keyboard hints to UI**
   - Show shortcuts in buttons/menus where relevant

### Phase 3: Polish (Optional)

7. **Shortcut reference panel (⌘/)**
   - Port `ShortcutReference.tsx` and `ShortcutHint.tsx`

8. **AI command glow effect**
   - Special styling for "Întreabă AI" command per design spec

9. **Keyword-based search**
   - Add keywords array to commands
   - Update filter to search keywords + title

## Files to Modify

| File                                                 | Changes                                 |
| ---------------------------------------------------- | --------------------------------------- |
| `apps/web/src/hooks/useCommandPalette.ts`            | Add icons, action commands, keywords    |
| `apps/web/src/components/layout/CommandPalette.tsx`  | Grouped sections, AI glow effect        |
| `apps/web/src/hooks/useKeyboardShortcuts.ts`         | New file - port from old                |
| `apps/web/src/components/layout/GlobalShortcuts.tsx` | New file - register shortcuts           |
| `apps/web/src/app/(dashboard)/layout.tsx`            | Add GlobalShortcuts component           |
| `apps/web/src/store/uiStore.ts`                      | Add shortcut reference state (optional) |

## Reference Files

| Purpose                 | Location                                                   |
| ----------------------- | ---------------------------------------------------------- |
| Design mockup           | `docs/design/ui-adaptation/mockups/command-palette.html`   |
| Old full implementation | `apps/web-old/src/components/layout/CommandPalette.tsx`    |
| Old shortcuts hook      | `apps/web-old/src/hooks/useKeyboardShortcuts.ts`           |
| Old global shortcuts    | `apps/web-old/src/components/linear/GlobalShortcuts.tsx`   |
| Requirements            | `docs/ops/issues/ops-354.md`, `docs/ops/issues/ops-369.md` |

## Testing Checklist

After implementation, verify:

- [ ] ⌘K opens command palette from any page
- [ ] Search filters commands by title
- [ ] ↑↓ navigation highlights commands
- [ ] Enter executes selected command
- [ ] Escape closes palette
- [ ] Icons render for all commands
- [ ] "Acțiuni Frecvente" section shows action commands
- [ ] "Navigare" section shows navigation commands
- [ ] ⌘N navigates to new case
- [ ] ⌘T opens task form
- [ ] ⌘L navigates to time tracking
- [ ] ⌘J opens AI assistant
- [ ] Clicking header search button opens palette
- [ ] All shortcuts work on deployed app (not just local)

## Deployment Notes

No special deployment configuration needed - this is purely frontend code. After implementing:

1. Run `pnpm preflight` to verify no type errors
2. Test locally with `pnpm dev`
3. Deploy with `pnpm deploy:production`
