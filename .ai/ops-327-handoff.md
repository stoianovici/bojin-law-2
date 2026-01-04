# [OPS-327] Keyboard Shortcuts System

## State

Core keyboard shortcuts infrastructure is complete and working:

- `useKeyboardShortcuts` hook with scope-based priority (component > page > global)
- `ShortcutHint` component for displaying keyboard shortcut badges
- `ShortcutReference` panel showing all available shortcuts (⌘/ to open)
- `GlobalShortcuts` component integrated into layout
- All global shortcuts working: ⌘K (command palette), ⌘/ (shortcuts reference), Escape (close modals)

Remaining items (lower priority per issue notes):

- Arrow key list navigation in cases/tasks lists
- Shortcut hints on hover (tooltip integration)

## Done This Session

1. Created `apps/web/src/hooks/useKeyboardShortcuts.ts`
   - Shortcut interface with key, modifiers, action, description, scope
   - Global registry pattern for managing shortcuts
   - Scope priority system (component > page > global)
   - Utility functions: `formatShortcut`, `getShortcutKeys`, `getAllShortcuts`

2. Created `apps/web/src/components/linear/ShortcutHint.tsx`
   - Renders keyboard shortcut keys in styled badges
   - Variants: default, muted, accent
   - Sizes: sm, md, lg
   - `ShortcutTooltip` helper for tooltip content

3. Created `apps/web/src/components/linear/ShortcutReference.tsx`
   - Slide-in panel from right side
   - Shows shortcuts organized by category (General, Navigare, Acțiuni Rapide)
   - Opens with ⌘/, closes with Escape or X button

4. Created `apps/web/src/components/linear/GlobalShortcuts.tsx`
   - Registers global shortcuts (⌘/, Escape)
   - Renders ShortcutReference panel

5. Updated `apps/web/src/stores/navigation.store.ts`
   - Added `isShortcutReferenceOpen` state
   - Added `openShortcutReference`, `closeShortcutReference`, `toggleShortcutReference` actions

6. Updated `packages/shared/types/src/navigation.ts`
   - Added new state and action types to NavigationState interface

7. Updated `apps/web/src/app/layout.tsx`
   - Added GlobalShortcuts component to layout

## Next Steps

1. **Arrow Key List Navigation** (pending)
   - Add `useKeyboardShortcuts` to list components (cases, tasks)
   - Track selected index, handle ArrowUp/ArrowDown
   - Handle Enter to open selected item

2. **Shortcut Hints on Hover** (pending)
   - Update tooltip components to optionally show shortcut hints
   - Add 500ms delay before showing hints
   - Use `ShortcutTooltip` component

## Key Files

- `apps/web/src/hooks/useKeyboardShortcuts.ts` - Hook and utilities
- `apps/web/src/components/linear/ShortcutHint.tsx` - Badge component
- `apps/web/src/components/linear/ShortcutReference.tsx` - Reference panel
- `apps/web/src/components/linear/GlobalShortcuts.tsx` - Global shortcuts provider
- `apps/web/src/stores/navigation.store.ts` - UI state
- `packages/shared/types/src/navigation.ts` - Type definitions
