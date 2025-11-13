/**
 * Command Palette Component
 * Modal for quick navigation and actions
 * Supports keyboard navigation and Romanian diacritics
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigationStore } from '@/stores/navigation.store';
import { useRouter } from 'next/navigation';
import type { Command } from '@legal-platform/types';

/**
 * Command palette commands configuration
 */
const commands: Command[] = [
  // Navigation commands
  {
    id: 'nav-dashboard',
    label: 'Go to Dashboard',
    description: 'Navigate to dashboard',
    icon: '📊',
    action: () => {},
    keywords: ['dashboard', 'home', 'overview'],
    section: 'dashboard',
  },
  {
    id: 'nav-cases',
    label: 'Go to Cases',
    description: 'Navigate to cases',
    icon: '⚖️',
    action: () => {},
    keywords: ['cases', 'cazuri', 'legal'],
    section: 'cases',
  },
  {
    id: 'nav-documents',
    label: 'Go to Documents',
    description: 'Navigate to documents',
    icon: '📄',
    action: () => {},
    keywords: ['documents', 'documente', 'files'],
    section: 'documents',
  },
  {
    id: 'nav-tasks',
    label: 'Go to Tasks',
    description: 'Navigate to tasks',
    icon: '✓',
    action: () => {},
    keywords: ['tasks', 'sarcini', 'todo'],
    section: 'tasks',
  },
  // Action commands
  {
    id: 'action-new-case',
    label: 'Create New Case',
    description: 'Create a new legal case',
    icon: '➕',
    action: () => {},
    keywords: ['create', 'new', 'case', 'caz'],
  },
  {
    id: 'action-new-document',
    label: 'Create Document',
    description: 'Create a new document',
    icon: '📝',
    action: () => {},
    keywords: ['create', 'document', 'document', 'new'],
  },
  {
    id: 'action-new-task',
    label: 'Add Task',
    description: 'Add a new task',
    icon: '📋',
    action: () => {},
    keywords: ['add', 'task', 'sarcină', 'new'],
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
 * - Backdrop blur effect
 */
export function CommandPalette({ className = '' }: CommandPaletteProps) {
  const router = useRouter();
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    setCurrentSection,
  } = useNavigationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on search query
  const filteredCommands = commands.filter((command) => {
    const query = searchQuery.toLowerCase();
    return (
      command.label.toLowerCase().includes(query) ||
      command.description.toLowerCase().includes(query) ||
      command.keywords.some((keyword) => keyword.toLowerCase().includes(query))
    );
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleCommandSelect(filteredCommands[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex]);

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

  return (
    <Dialog.Root open={isCommandPaletteOpen} onOpenChange={(open) => {
      if (!open) closeCommandPalette();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed inset-0 z-50
            bg-black/50 backdrop-blur-sm
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
          "
        />
        <Dialog.Content
          className={`
            ${className}
            fixed left-1/2 top-1/2 z-50
            -translate-x-1/2 -translate-y-1/2
            w-full max-w-2xl max-h-[80vh]
            bg-white rounded-lg shadow-2xl
            flex flex-col
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            data-[state=closed]:slide-out-to-top-[10%] data-[state=open]:slide-in-from-top-[10%]
          `}
        >
          {/* Accessible title for screen readers */}
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search and execute commands quickly using keyboard shortcuts
          </Dialog.Description>

          {/* Search Input */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                role="textbox"
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                autoFocus
                className="
                  flex-1 text-base
                  bg-transparent border-none outline-none
                  placeholder-gray-400 text-gray-900
                "
                aria-label="Search commands"
              />
              <kbd className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-300 rounded">
                ESC
              </kbd>
            </div>
          </div>

          {/* Command List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No commands found
              </div>
            ) : (
              <div className="space-y-1" role="listbox">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={() => handleCommandSelect(command)}
                    data-selected={index === selectedIndex}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg
                      text-left transition-colors
                      ${
                        index === selectedIndex
                          ? 'bg-blue-50 text-blue-900'
                          : 'hover:bg-gray-100 text-gray-900'
                      }
                      focus:outline-none focus:bg-blue-50
                    `}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    <span className="text-2xl flex-shrink-0" aria-hidden="true">
                      {command.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {command.label}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {command.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↵</kbd>
              to select
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
