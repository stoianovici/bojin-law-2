'use client';

/**
 * GlobalShortcuts Component
 * Registers global keyboard shortcuts for the application
 * Include this at the root layout level
 */

import * as React from 'react';
import { useKeyboardShortcuts, type Shortcut } from '../../hooks/useKeyboardShortcuts';
import { useNavigationStore } from '../../stores/navigation.store';
import { ShortcutReference } from './ShortcutReference';

export function GlobalShortcuts() {
  const {
    closeCommandPalette,
    isCommandPaletteOpen,
    toggleShortcutReference,
    closeShortcutReference,
    isShortcutReferenceOpen,
  } = useNavigationStore();

  // Define global shortcuts
  const shortcuts: Shortcut[] = React.useMemo(
    () => [
      // ⌘K - Command palette (already handled in CommandMenu, but keeping for reference)
      // Note: CommandMenu handles its own ⌘K shortcut

      // ⌘/ - Show shortcuts reference
      {
        key: '/',
        modifiers: ['meta'],
        action: () => toggleShortcutReference(),
        description: 'Afișează comenzile rapide',
        scope: 'global',
      },

      // Escape - Close any open modal/panel
      {
        key: 'Escape',
        action: () => {
          // Close in priority order
          if (isShortcutReferenceOpen) {
            closeShortcutReference();
          } else if (isCommandPaletteOpen) {
            closeCommandPalette();
          }
          // Other modals would be handled by their own components
        },
        description: 'Închide modal/panou',
        scope: 'global',
      },
    ],
    [
      isCommandPaletteOpen,
      isShortcutReferenceOpen,
      closeCommandPalette,
      closeShortcutReference,
      toggleShortcutReference,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  // Render the shortcut reference panel
  return <ShortcutReference />;
}
