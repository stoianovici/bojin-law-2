/**
 * CommandMenu Component
 * Unified command palette using cmdk library
 * Combines quick navigation, commands, and live search results
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import * as Dialog from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Scale,
  FileText,
  CheckSquare,
  PlusCircle,
  FileEdit,
  ClipboardList,
  Search,
  Mail,
  User,
  Settings,
  Briefcase,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react';
import {
  useSearch,
  useRecentSearches,
  isCaseResult,
  isDocumentResult,
  isClientResult,
  type SearchResult,
} from '../../hooks/useSearch';
import { useNavigationStore } from '../../stores/navigation.store';

// ============================================================================
// Types
// ============================================================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

// ============================================================================
// Constants
// ============================================================================

const DEBOUNCE_MS = 300;
const MAX_RESULTS_PER_GROUP = 5;

// Linear-style group heading classes
const GROUP_HEADING_STYLES = 'mb-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-linear-text-tertiary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5';

// Linear-style item classes
const ITEM_STYLES = clsx(
  'flex items-center gap-3 px-3 py-2 rounded-md',
  'cursor-pointer',
  'aria-selected:bg-linear-bg-hover',
  'hover:bg-linear-bg-hover',
  'transition-colors duration-100'
);

// ============================================================================
// Component
// ============================================================================

export interface CommandMenuProps {
  className?: string;
}

/**
 * CommandMenu component - unified command palette
 * Features:
 * - Cmd+K / Ctrl+K to open
 * - Static navigation and action commands
 * - Live search results with debounce
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Romanian UI text
 */
export function CommandMenu({ className }: CommandMenuProps) {
  const router = useRouter();
  const { isCommandPaletteOpen, openCommandPalette, closeCommandPalette, setCurrentSection } =
    useNavigationStore();
  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  // Search hooks
  const { search, results, loading: searchLoading } = useSearch({ defaultLimit: 15 });
  const { recentSearches } = useRecentSearches(5);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedValue.trim().length >= 2) {
      search(debouncedValue);
    }
  }, [debouncedValue, search]);

  // Reset state handler - called on modal close
  const resetState = useCallback(() => {
    setInputValue('');
    setDebouncedValue('');
  }, []);

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isCommandPaletteOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isCommandPaletteOpen, openCommandPalette, closeCommandPalette]);

  // Navigation helper
  const navigateTo = useCallback(
    (path: string, section?: string) => {
      if (section) {
        setCurrentSection(section as Parameters<typeof setCurrentSection>[0]);
      }
      router.push(path);
      closeCommandPalette();
    },
    [router, setCurrentSection, closeCommandPalette]
  );

  // Handle search result selection
  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      if (isCaseResult(result)) {
        navigateTo(`/cases/${result.case.id}`, 'cases');
      } else if (isDocumentResult(result)) {
        navigateTo(`/documents/${result.document.id}`, 'documents');
      } else if (isClientResult(result)) {
        navigateTo(`/clients/${result.client.id}`);
      }
    },
    [navigateTo]
  );

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback(
    (query: string) => {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      closeCommandPalette();
    },
    [router, closeCommandPalette]
  );

  // Static command groups
  const commandGroups: CommandGroup[] = [
    {
      heading: 'Navigare',
      items: [
        {
          id: 'nav-dashboard',
          label: 'Panou de control',
          description: 'Pagina principală',
          icon: LayoutDashboard,
          action: () => navigateTo('/', 'dashboard'),
          keywords: ['dashboard', 'home', 'acasa'],
        },
        {
          id: 'nav-cases',
          label: 'Dosare',
          description: 'Gestionare dosare',
          icon: Scale,
          action: () => navigateTo('/cases', 'cases'),
          keywords: ['cases', 'cazuri', 'dosare', 'legal'],
        },
        {
          id: 'nav-documents',
          label: 'Documente',
          description: 'Bibliotecă documente',
          icon: FileText,
          action: () => navigateTo('/documents', 'documents'),
          keywords: ['documents', 'documente', 'files', 'fisiere'],
        },
        {
          id: 'nav-tasks',
          label: 'Sarcini',
          description: 'Lista de sarcini',
          icon: CheckSquare,
          action: () => navigateTo('/tasks', 'tasks'),
          keywords: ['tasks', 'sarcini', 'todo'],
        },
        {
          id: 'nav-communications',
          label: 'Comunicări',
          description: 'Email și mesaje',
          icon: Mail,
          action: () => navigateTo('/communications', 'communications'),
          keywords: ['email', 'communications', 'comunicari', 'mesaje'],
        },
        {
          id: 'nav-time-tracking',
          label: 'Pontaj',
          description: 'Evidență timp',
          icon: Clock,
          action: () => navigateTo('/time-tracking', 'time-tracking'),
          keywords: ['time', 'tracking', 'pontaj', 'ore'],
        },
        {
          id: 'nav-reports',
          label: 'Rapoarte',
          description: 'Statistici și rapoarte',
          icon: BarChart3,
          action: () => navigateTo('/reports', 'reports'),
          keywords: ['reports', 'rapoarte', 'statistics', 'statistici'],
        },
      ],
    },
    {
      heading: 'Acțiuni',
      items: [
        {
          id: 'action-new-case',
          label: 'Dosar nou',
          description: 'Creează un dosar nou',
          icon: PlusCircle,
          action: () => navigateTo('/cases/new', 'cases'),
          keywords: ['create', 'new', 'case', 'dosar', 'nou'],
        },
        {
          id: 'action-new-document',
          label: 'Document nou',
          description: 'Încarcă un document',
          icon: FileEdit,
          action: () => navigateTo('/documents?action=upload', 'documents'),
          keywords: ['create', 'document', 'upload', 'incarcare'],
        },
        {
          id: 'action-new-task',
          label: 'Sarcină nouă',
          description: 'Adaugă o sarcină',
          icon: ClipboardList,
          action: () => navigateTo('/tasks?action=new', 'tasks'),
          keywords: ['add', 'task', 'sarcina', 'noua'],
        },
        {
          id: 'action-settings',
          label: 'Setări',
          description: 'Configurări aplicație',
          icon: Settings,
          action: () => navigateTo('/settings/billing'),
          keywords: ['settings', 'setari', 'configurare'],
        },
      ],
    },
  ];

  // Group search results by type
  const groupedResults = {
    cases: results.filter(isCaseResult).slice(0, MAX_RESULTS_PER_GROUP),
    documents: results.filter(isDocumentResult).slice(0, MAX_RESULTS_PER_GROUP),
    clients: results.filter(isClientResult).slice(0, MAX_RESULTS_PER_GROUP),
  };

  const hasSearchResults =
    groupedResults.cases.length > 0 ||
    groupedResults.documents.length > 0 ||
    groupedResults.clients.length > 0;

  const showSearchResults = debouncedValue.trim().length >= 2;

  return (
    <Command.Dialog
      open={isCommandPaletteOpen}
      onOpenChange={(open) => {
        if (open) {
          openCommandPalette();
        } else {
          resetState();
          closeCommandPalette();
        }
      }}
      label="Meniu de comandă"
      className={clsx('fixed inset-0 z-50', 'flex items-start justify-center pt-[20vh]', className)}
    >
      {/* Backdrop - Linear style with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-[4px]"
        onClick={closeCommandPalette}
        aria-hidden="true"
      />

      {/* Dialog Content - Linear dark elevated style */}
      <div
        className={clsx(
          'relative z-10',
          'w-full max-w-[560px] mx-4',
          'bg-linear-bg-elevated rounded-xl',
          'border border-linear-border',
          'shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
          'overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Visually hidden title for accessibility */}
        <VisuallyHidden.Root asChild>
          <Dialog.Title>Meniu de comandă</Dialog.Title>
        </VisuallyHidden.Root>

        {/* Search Input - Linear transparent style */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-linear-border-subtle">
          {searchLoading ? (
            <Loader2 className="w-5 h-5 text-linear-text-muted animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-linear-text-muted flex-shrink-0" />
          )}
          <Command.Input
            value={inputValue}
            onValueChange={setInputValue}
            placeholder="Caută sau rulează o comandă..."
            className={clsx(
              'flex-1 text-[15px] bg-transparent',
              'border-none outline-none',
              'placeholder:text-linear-text-muted text-linear-text-primary'
            )}
          />
          <kbd
            className={clsx(
              'hidden sm:inline-flex',
              'px-2 py-1 text-[11px] font-medium',
              'text-linear-text-tertiary bg-linear-bg-tertiary',
              'border border-linear-border rounded'
            )}
          >
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <Command.List className={clsx('max-h-[60vh] overflow-y-auto p-2', 'scroll-py-2')}>
          <Command.Empty className="py-8 text-center text-linear-text-tertiary">
            Niciun rezultat găsit.
          </Command.Empty>

          {/* Search Results */}
          {showSearchResults && hasSearchResults && (
            <>
              {/* Case Results */}
              {groupedResults.cases.length > 0 && (
                <Command.Group heading="Dosare" className={GROUP_HEADING_STYLES}>
                  {groupedResults.cases.map((result) => (
                    <Command.Item
                      key={`case-${result.case.id}`}
                      value={`case ${result.case.caseNumber} ${result.case.title}`}
                      onSelect={() => handleResultSelect(result)}
                      className={ITEM_STYLES}
                    >
                      <Briefcase className="w-5 h-5 text-linear-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-linear-text-primary">
                          {result.case.caseNumber}: {result.case.title}
                        </div>
                        <div className="text-sm text-linear-text-tertiary truncate">
                          {result.case.client?.name || 'Client necunoscut'}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Document Results */}
              {groupedResults.documents.length > 0 && (
                <Command.Group heading="Documente" className={GROUP_HEADING_STYLES}>
                  {groupedResults.documents.map((result) => (
                    <Command.Item
                      key={`doc-${result.document.id}`}
                      value={`document ${result.document.fileName}`}
                      onSelect={() => handleResultSelect(result)}
                      className={ITEM_STYLES}
                    >
                      <FileText className="w-5 h-5 text-linear-success flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-linear-text-primary">{result.document.fileName}</div>
                        <div className="text-sm text-linear-text-tertiary truncate">
                          {result.document.fileType} •{' '}
                          {result.document.client?.name || 'Fără client'}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Client Results */}
              {groupedResults.clients.length > 0 && (
                <Command.Group heading="Clienți" className={GROUP_HEADING_STYLES}>
                  {groupedResults.clients.map((result) => (
                    <Command.Item
                      key={`client-${result.client.id}`}
                      value={`client ${result.client.name}`}
                      onSelect={() => handleResultSelect(result)}
                      className={ITEM_STYLES}
                    >
                      <User className="w-5 h-5 text-linear-warning flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-linear-text-primary">{result.client.name}</div>
                        {result.client.address && (
                          <div className="text-sm text-linear-text-tertiary truncate">
                            {result.client.address}
                          </div>
                        )}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* See All Results Link */}
              {results.length > 0 && (
                <Command.Item
                  value="see-all-results"
                  onSelect={() => {
                    router.push(`/search?q=${encodeURIComponent(debouncedValue)}`);
                    closeCommandPalette();
                  }}
                  className={clsx(ITEM_STYLES, 'text-linear-accent')}
                >
                  <Search className="w-5 h-5 flex-shrink-0" />
                  <span>Vezi toate rezultatele pentru &quot;{debouncedValue}&quot;</span>
                </Command.Item>
              )}
            </>
          )}

          {/* Recent Searches - shown when no search query */}
          {!showSearchResults && recentSearches.length > 0 && (
            <Command.Group heading="Căutări recente" className={GROUP_HEADING_STYLES}>
              {recentSearches.map((recent) => (
                <Command.Item
                  key={recent.id}
                  value={`recent ${recent.query}`}
                  onSelect={() => handleRecentSearchSelect(recent.query)}
                  className={ITEM_STYLES}
                >
                  <Clock className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
                  <span className="flex-1 truncate text-linear-text-secondary">{recent.query}</span>
                  <span className="text-xs text-linear-text-muted">{recent.resultCount} rezultate</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Static Command Groups */}
          {!showSearchResults &&
            commandGroups.map((group) => (
              <Command.Group key={group.heading} heading={group.heading} className={GROUP_HEADING_STYLES}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                      onSelect={item.action}
                      className={ITEM_STYLES}
                    >
                      <Icon className="w-5 h-5 text-linear-text-tertiary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-linear-text-primary">{item.label}</div>
                        {item.description && (
                          <div className="text-sm text-linear-text-tertiary">{item.description}</div>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
        </Command.List>

        {/* Footer with keyboard hints - Linear style */}
        <div
          className={clsx(
            'px-4 py-2.5 border-t border-linear-border-subtle bg-linear-bg-tertiary',
            'flex items-center justify-center gap-4',
            'text-xs text-linear-text-muted'
          )}
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-linear-bg-elevated border border-linear-border rounded text-linear-text-tertiary">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-linear-bg-elevated border border-linear-border rounded text-linear-text-tertiary">↓</kbd>
            navigare
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-linear-bg-elevated border border-linear-border rounded text-linear-text-tertiary">↵</kbd>
            selectare
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-linear-bg-elevated border border-linear-border rounded text-linear-text-tertiary">esc</kbd>
            închide
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}

CommandMenu.displayName = 'CommandMenu';
