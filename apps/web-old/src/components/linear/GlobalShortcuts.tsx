'use client';

/**
 * GlobalShortcuts Component
 * OPS-369: Keyboard Shortcuts System
 * Registers global keyboard shortcuts for the application
 * Include this at the root layout level
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts, type Shortcut } from '../../hooks/useKeyboardShortcuts';
import { useNavigationStore } from '../../stores/navigation.store';
import { ShortcutReference } from './ShortcutReference';

export function GlobalShortcuts() {
  const router = useRouter();
  const {
    closeCommandPalette,
    openCommandPalette,
    isCommandPaletteOpen,
    toggleShortcutReference,
    closeShortcutReference,
    isShortcutReferenceOpen,
    setCurrentSection,
  } = useNavigationStore();

  // Define global shortcuts
  const shortcuts: Shortcut[] = React.useMemo(
    () => [
      // ⌘K - Command palette (also handled in CommandMenu for toggle behavior)
      {
        key: 'k',
        modifiers: ['meta'],
        action: () => {
          if (isCommandPaletteOpen) {
            closeCommandPalette();
          } else {
            openCommandPalette();
          }
        },
        description: 'Paleta de comenzi',
        scope: 'global',
      },

      // ⌘/ - Show shortcuts reference
      {
        key: '/',
        modifiers: ['meta'],
        action: () => toggleShortcutReference(),
        description: 'Afișează comenzile rapide',
        scope: 'global',
      },

      // ⌘N - New case
      {
        key: 'n',
        modifiers: ['meta'],
        action: () => {
          setCurrentSection('cases');
          router.push('/cases/new');
        },
        description: 'Dosar nou',
        scope: 'global',
      },

      // ⌘T - New task
      {
        key: 't',
        modifiers: ['meta'],
        action: () => {
          setCurrentSection('tasks');
          router.push('/tasks?action=new');
        },
        description: 'Sarcină nouă',
        scope: 'global',
      },

      // ⌘L - Log time
      {
        key: 'l',
        modifiers: ['meta'],
        action: () => {
          setCurrentSection('time-tracking');
          router.push('/pontaj');
        },
        description: 'Înregistrare timp',
        scope: 'global',
      },

      // ⌘J - AI assistant (opens command palette for now)
      {
        key: 'j',
        modifiers: ['meta'],
        action: () => {
          openCommandPalette();
        },
        description: 'Asistent AI',
        scope: 'global',
      },

      // ⌘G - Go to case (opens command palette)
      {
        key: 'g',
        modifiers: ['meta'],
        action: () => {
          openCommandPalette();
        },
        description: 'Salt la dosar',
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
      openCommandPalette,
      closeShortcutReference,
      toggleShortcutReference,
      setCurrentSection,
      router,
    ]
  );

  useKeyboardShortcuts(shortcuts);

  // Render the shortcut reference panel
  return <ShortcutReference />;
}
