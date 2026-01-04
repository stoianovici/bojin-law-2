/**
 * Command Palette Component
 * OPS-354: Command Palette Enhancement
 * Modal for quick navigation and actions with Linear design
 * Supports keyboard navigation and Romanian diacritics
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import { useRouter } from 'next/navigation';
import type { Command } from '@legal-platform/types';
import {
  LayoutDashboard,
  Scale,
  FileText,
  CheckSquare,
  Plus,
  Clock,
  Sparkles,
  Users,
  Search,
  Command as CommandIcon,
  type LucideIcon,
} from 'lucide-react';

// ====================================
// Types
// ====================================

interface CommandWithSection extends Command {
  group: 'actions' | 'navigation';
  shortcut?: string;
}

// ====================================
// Icon mapping for command palette
// ====================================

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  cases: Scale,
  documents: FileText,
  tasks: CheckSquare,
  'new-case': Plus,
  'new-task': CheckSquare,
  'time-entry': Clock,
  'ask-ai': Sparkles,
  'goto-case': Scale,
  'search-client': Users,
};

// ====================================
// Command palette commands configuration (Romanian)
// ====================================

const commands: CommandWithSection[] = [
  // Acțiuni Frecvente (Frequent Actions)
  {
    id: 'action-new-case',
    label: 'Caz nou',
    description: 'Creează un dosar nou',
    icon: 'new-case',
    action: () => {},
    keywords: ['create', 'new', 'case', 'caz', 'dosar', 'nou'],
    group: 'actions',
    shortcut: '⌘N',
  },
  {
    id: 'action-new-task',
    label: 'Sarcină nouă',
    description: 'Adaugă o sarcină nouă',
    icon: 'new-task',
    action: () => {},
    keywords: ['add', 'task', 'sarcină', 'new', 'nou'],
    group: 'actions',
    shortcut: '⌘T',
  },
  {
    id: 'action-time-entry',
    label: 'Înregistrare timp',
    description: 'Înregistrează timpul lucrat',
    icon: 'time-entry',
    action: () => {},
    keywords: ['time', 'timp', 'ore', 'înregistrare', 'track'],
    group: 'actions',
    shortcut: '⌘L',
  },
  {
    id: 'action-ask-ai',
    label: 'Întreabă AI',
    description: 'Obține asistență AI',
    icon: 'ask-ai',
    action: () => {},
    keywords: ['ai', 'assistant', 'help', 'întreabă', 'ajutor'],
    group: 'actions',
    shortcut: '⌘J',
  },
  // Navigare (Navigation)
  {
    id: 'nav-goto-case',
    label: 'Salt la caz...',
    description: 'Navighează la un dosar',
    icon: 'goto-case',
    action: () => {},
    keywords: ['go', 'navigate', 'case', 'caz', 'dosar', 'salt'],
    section: 'cases',
    group: 'navigation',
    shortcut: '⌘G',
  },
  {
    id: 'nav-search-client',
    label: 'Caută client...',
    description: 'Găsește un client',
    icon: 'search-client',
    action: () => {},
    keywords: ['search', 'client', 'caută', 'găsește'],
    group: 'navigation',
    shortcut: '⌘P',
  },
  {
    id: 'nav-dashboard',
    label: 'Panou principal',
    description: 'Navighează la dashboard',
    icon: 'dashboard',
    action: () => {},
    keywords: ['dashboard', 'home', 'panou', 'principal', 'acasă'],
    section: 'dashboard',
    group: 'navigation',
  },
  {
    id: 'nav-cases',
    label: 'Dosare',
    description: 'Navighează la dosare',
    icon: 'cases',
    action: () => {},
    keywords: ['cases', 'cazuri', 'dosare', 'legal'],
    section: 'cases',
    group: 'navigation',
  },
  {
    id: 'nav-documents',
    label: 'Documente',
    description: 'Navighează la documente',
    icon: 'documents',
    action: () => {},
    keywords: ['documents', 'documente', 'files', 'fișiere'],
    section: 'documents',
    group: 'navigation',
  },
  {
    id: 'nav-tasks',
    label: 'Sarcini',
    description: 'Navighează la sarcini',
    icon: 'tasks',
    action: () => {},
    keywords: ['tasks', 'sarcini', 'todo'],
    section: 'tasks',
    group: 'navigation',
  },
];

export interface CommandPaletteProps {
  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Command Palette component for quick navigation and actions
 * Features:
 * - Real-time search filtering
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Romanian diacritic support in search
 * - Grouped actions (Acțiuni Frecvente, Navigare)
 * - Linear-style design with 520px width, top-center positioning
 */
export function CommandPalette({ className = '' }: CommandPaletteProps) {
  const router = useRouter();
  const { isCommandPaletteOpen, closeCommandPalette, setCurrentSection } = useNavigationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(query) ||
        command.description.toLowerCase().includes(query) ||
        command.keywords.some((keyword) => keyword.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  // Group filtered commands by section
  const groupedCommands = useMemo(() => {
    const actions = filteredCommands.filter((cmd) => cmd.group === 'actions');
    const navigation = filteredCommands.filter((cmd) => cmd.group === 'navigation');
    return { actions, navigation };
  }, [filteredCommands]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  // Helper to get command from flat index (moved before useEffect for use in handler)
  const getCommandFromFlatIndexFn = (flatIndex: number): CommandWithSection | undefined => {
    if (flatIndex < groupedCommands.actions.length) {
      return groupedCommands.actions[flatIndex];
    }
    return groupedCommands.navigation[flatIndex - groupedCommands.actions.length];
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
          break;
        case 'Enter':
          event.preventDefault();
          const selectedCommand = getCommandFromFlatIndexFn(selectedIndex);
          if (selectedCommand) {
            handleCommandSelect(selectedCommand);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex, groupedCommands]);

  // Handle command selection
  const handleCommandSelect = (command: Command) => {
    // Navigate if it's a navigation command
    if (command.section) {
      setCurrentSection(command.section);
      const routes: Record<string, string> = {
        dashboard: '/',
        cases: '/cases',
        documents: '/documents',
        tasks: '/tasks',
        communications: '/communications',
        'time-tracking': '/time-tracking',
        reports: '/reports',
      };
      const route = routes[command.section];
      if (route) {
        router.push(route);
      }
    }

    // Execute command action
    command.action();

    // Close palette
    closeCommandPalette();
  };

  // Helper to get flat index from grouped commands
  const getFlatIndex = (group: 'actions' | 'navigation', indexInGroup: number): number => {
    if (group === 'actions') return indexInGroup;
    return groupedCommands.actions.length + indexInGroup;
  };

  return (
    <Dialog.Root
      open={isCommandPaletteOpen}
      onOpenChange={(open) => {
        if (!open) closeCommandPalette();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-50
            bg-black/60 backdrop-blur-sm
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
          "
        />
        <Dialog.Content
          className={`
            ${className}
            fixed left-1/2 top-[15vh] z-50
            -translate-x-1/2
            w-[520px] max-w-[90vw]
            bg-linear-bg-secondary rounded-2xl
            shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_60px_rgba(0,0,0,0.5)]
            border border-linear-border
            flex flex-col overflow-hidden
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
          `}
        >
          {/* Accessible title for screen readers */}
          <Dialog.Title className="sr-only">Paleta de comenzi</Dialog.Title>
          <Dialog.Description className="sr-only">
            Caută și execută comenzi rapid folosind scurtături de tastatură
          </Dialog.Description>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-linear-border-subtle">
            <div className="flex items-center gap-3">
              <CommandIcon className="w-5 h-5 text-linear-accent" aria-hidden="true" />
              <span className="text-sm font-semibold text-linear-text-primary">Acțiuni rapide</span>
            </div>
            <kbd className="px-2 py-1 text-xs font-mono text-linear-text-muted bg-linear-bg-tertiary rounded-md">
              ⌘K
            </kbd>
          </div>

          {/* Search Input */}
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 bg-linear-bg-tertiary border border-linear-border-subtle rounded-lg px-4 py-3 focus-within:border-linear-accent focus-within:ring-[3px] focus-within:ring-linear-accent/15">
              <Search
                className="w-[18px] h-[18px] text-linear-text-tertiary flex-shrink-0"
                aria-hidden="true"
              />
              <input
                type="text"
                role="textbox"
                placeholder="Caută sau execută o comandă..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                autoFocus
                className="
                  flex-1 text-sm
                  bg-transparent border-none outline-none
                  placeholder-linear-text-tertiary text-linear-text-primary
                "
                aria-label="Caută comenzi"
              />
            </div>
          </div>

          {/* Command List */}
          <div className="flex-1 overflow-y-auto py-2 max-h-[400px]">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-linear-text-tertiary">Nicio comandă găsită</div>
            ) : (
              <div role="listbox">
                {/* Acțiuni Frecvente */}
                {groupedCommands.actions.length > 0 && (
                  <div className="px-5 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-linear-text-tertiary py-2">
                      Acțiuni Frecvente
                    </div>
                    {groupedCommands.actions.map((command, indexInGroup) => {
                      const flatIndex = getFlatIndex('actions', indexInGroup);
                      const IconComponent = iconMap[command.icon];
                      const isAI = command.id === 'action-ask-ai';
                      return (
                        <button
                          key={command.id}
                          onClick={() => handleCommandSelect(command)}
                          data-selected={flatIndex === selectedIndex}
                          className={`
                            w-full flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg
                            text-left transition-colors
                            ${
                              flatIndex === selectedIndex
                                ? 'bg-linear-bg-active'
                                : 'hover:bg-linear-bg-hover'
                            }
                            focus:outline-none
                          `}
                          role="option"
                          aria-selected={flatIndex === selectedIndex}
                        >
                          <div
                            className={`
                              w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                              ${isAI ? 'bg-linear-accent/15 text-linear-accent shadow-[0_0_12px_rgba(94,106,210,0.4)]' : 'bg-linear-bg-tertiary text-linear-text-secondary'}
                            `}
                          >
                            {IconComponent && (
                              <IconComponent className="w-[18px] h-[18px]" aria-hidden="true" />
                            )}
                          </div>
                          <span className="flex-1 text-sm font-medium text-linear-text-primary">
                            {command.label}
                          </span>
                          {command.shortcut && (
                            <kbd className="text-xs font-mono text-linear-text-muted bg-linear-bg-tertiary px-2 py-0.5 rounded-md">
                              {command.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Navigare */}
                {groupedCommands.navigation.length > 0 && (
                  <div className="px-5 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-linear-text-tertiary py-2">
                      Navigare
                    </div>
                    {groupedCommands.navigation.map((command, indexInGroup) => {
                      const flatIndex = getFlatIndex('navigation', indexInGroup);
                      const IconComponent = iconMap[command.icon];
                      return (
                        <button
                          key={command.id}
                          onClick={() => handleCommandSelect(command)}
                          data-selected={flatIndex === selectedIndex}
                          className={`
                            w-full flex items-center gap-3 py-3 px-4 -mx-4 rounded-lg
                            text-left transition-colors
                            ${
                              flatIndex === selectedIndex
                                ? 'bg-linear-bg-active'
                                : 'hover:bg-linear-bg-hover'
                            }
                            focus:outline-none
                          `}
                          role="option"
                          aria-selected={flatIndex === selectedIndex}
                        >
                          <div className="w-9 h-9 rounded-lg bg-linear-bg-tertiary flex items-center justify-center flex-shrink-0 text-linear-text-secondary">
                            {IconComponent && (
                              <IconComponent className="w-[18px] h-[18px]" aria-hidden="true" />
                            )}
                          </div>
                          <span className="flex-1 text-sm font-medium text-linear-text-primary">
                            {command.label}
                          </span>
                          {command.shortcut && (
                            <kbd className="text-xs font-mono text-linear-text-muted bg-linear-bg-tertiary px-2 py-0.5 rounded-md">
                              {command.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
