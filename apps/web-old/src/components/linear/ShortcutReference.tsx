'use client';

/**
 * ShortcutReference Component
 * Displays a modal panel with all available keyboard shortcuts
 */

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigationStore } from '../../stores/navigation.store';
import { ShortcutHint, getMetaKey } from './ShortcutHint';

// ====================================================================
// Shortcut Categories
// ====================================================================

interface ShortcutInfo {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutInfo[];
}

function getShortcutCategories(): ShortcutCategory[] {
  const meta = getMetaKey();

  return [
    {
      name: 'General',
      shortcuts: [
        { keys: [meta, 'K'], description: 'Paleta de comenzi' },
        { keys: [meta, '/'], description: 'Afișează comenzile rapide' },
        { keys: ['Esc'], description: 'Închide modal/panou' },
      ],
    },
    {
      name: 'Acțiuni Rapide',
      shortcuts: [
        { keys: [meta, 'N'], description: 'Dosar nou' },
        { keys: [meta, 'T'], description: 'Sarcină nouă' },
        { keys: [meta, 'L'], description: 'Înregistrare timp' },
        { keys: [meta, 'J'], description: 'Asistent AI' },
        { keys: [meta, 'G'], description: 'Salt la dosar' },
      ],
    },
    {
      name: 'Navigare',
      shortcuts: [
        { keys: ['↑'], description: 'Element anterior' },
        { keys: ['↓'], description: 'Element următor' },
        { keys: ['↵'], description: 'Selectare / Deschide' },
        { keys: ['←'], description: 'Restrânge / Înapoi' },
        { keys: ['→'], description: 'Extinde / Înainte' },
      ],
    },
    {
      name: 'În Formulare',
      shortcuts: [
        { keys: [meta, '↵'], description: 'Trimite formular' },
        { keys: ['Tab'], description: 'Câmpul următor' },
        { keys: ['⇧', 'Tab'], description: 'Câmpul anterior' },
      ],
    },
  ];
}

// ====================================================================
// Component
// ====================================================================

export function ShortcutReference() {
  const { isShortcutReferenceOpen, closeShortcutReference } = useNavigationStore();
  const categories = React.useMemo(() => getShortcutCategories(), []);

  return (
    <Dialog.Root
      open={isShortcutReferenceOpen}
      onOpenChange={(open) => !open && closeShortcutReference()}
    >
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className={clsx(
            'fixed inset-0 z-50',
            'bg-black/60 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />

        {/* Panel */}
        <Dialog.Content
          className={clsx(
            'fixed right-4 top-4 bottom-4 z-50',
            'w-full max-w-sm',
            'bg-linear-bg-elevated rounded-xl',
            'border border-linear-border',
            'shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
            'overflow-hidden flex flex-col',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
            <Dialog.Title className="text-sm font-medium text-linear-text-primary">
              Comenzi Rapide
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={clsx(
                  'p-1.5 rounded-md',
                  'text-linear-text-tertiary hover:text-linear-text-secondary',
                  'hover:bg-linear-bg-hover',
                  'transition-colors'
                )}
                aria-label="Închide"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {categories.map((category) => (
              <div key={category.name}>
                {/* Category Header */}
                <h3
                  className={clsx(
                    'text-[11px] font-semibold uppercase tracking-wider',
                    'text-linear-text-tertiary',
                    'mb-3'
                  )}
                >
                  {category.name}
                </h3>

                {/* Shortcuts */}
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className={clsx(
                        'flex items-center justify-between gap-4',
                        'px-3 py-2 rounded-md',
                        'bg-linear-bg-secondary'
                      )}
                    >
                      <span className="text-sm text-linear-text-secondary">
                        {shortcut.description}
                      </span>
                      <ShortcutHint keys={shortcut.keys} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className={clsx(
              'px-4 py-3 border-t border-linear-border-subtle',
              'text-xs text-linear-text-muted text-center'
            )}
          >
            Apasă <ShortcutHint keys={['Esc']} size="sm" variant="muted" /> pentru a închide
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
