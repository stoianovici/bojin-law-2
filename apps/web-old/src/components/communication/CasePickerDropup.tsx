'use client';

/**
 * CasePickerDropup Component
 * OPS-206: Inline case picker for NECLAR emails without suggestions
 *
 * A drop-up menu for selecting a case to assign an email to.
 * Used when there are no AI-suggested cases for an email.
 *
 * Features:
 * - Opens upward from action bar
 * - Search/filter input for 10+ cases
 * - Shows all user's cases
 * - Click to assign immediately
 * - Close on outside click or Escape
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronUp, Search, Folder, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useMyCases } from '../../hooks/useMyCases';

// ============================================================================
// Types
// ============================================================================

export interface CasePickerDropupProps {
  /** Called when a case is selected */
  onSelect: (caseId: string) => void;
  /** Shows loading state on buttons */
  loading?: boolean;
  /** Disables all interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CasePickerDropup({
  onSelect,
  loading = false,
  disabled = false,
  className,
}: CasePickerDropupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { cases, loading: casesLoading } = useMyCases();

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;

    const query = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber?.toLowerCase().includes(query) ||
        c.client?.name?.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  // Show search input only when there are more than 10 cases
  const showSearch = cases.length > 10;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, showSearch]);

  const handleToggle = useCallback(() => {
    if (disabled || loading) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [disabled, loading, isOpen]);

  const handleCaseSelect = useCallback(
    (caseId: string) => {
      if (loading || disabled) return;
      setSelectedCaseId(caseId);
      setIsOpen(false);
      setSearchQuery('');
      onSelect(caseId);
    },
    [loading, disabled, onSelect]
  );

  const isDisabled = loading || disabled;

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        disabled={isDisabled}
        className={clsx(
          'flex items-center justify-center gap-2 px-4 py-2.5',
          'rounded-lg font-medium text-sm transition-all',
          'bg-linear-warning text-white hover:bg-linear-warning/90',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isOpen && 'bg-linear-warning/90'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {loading && selectedCaseId ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Se atribuie...</span>
          </>
        ) : (
          <>
            <Folder className="h-4 w-4" />
            <span>Atribuie la dosar</span>
            <ChevronUp className={clsx('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          </>
        )}
      </button>

      {/* Drop-up Menu */}
      {isOpen && (
        <div
          className={clsx(
            'absolute bottom-full left-0 mb-2 w-80 max-h-72',
            'bg-linear-bg-secondary rounded-lg shadow-lg border border-linear-border-subtle',
            'animate-in fade-in-0 slide-in-from-bottom-2 duration-150',
            'flex flex-col overflow-hidden z-50'
          )}
          role="listbox"
        >
          {/* Search Input (only for 10+ cases) */}
          {showSearch && (
            <div className="p-2 border-b border-linear-border-subtle/50 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-linear-text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Caută dosar..."
                  className={clsx(
                    'w-full pl-9 pr-3 py-2 text-sm bg-linear-bg-tertiary',
                    'border border-linear-border-subtle rounded-md',
                    'focus:outline-none focus:ring-2 focus:ring-linear-warning focus:border-transparent'
                  )}
                />
              </div>
            </div>
          )}

          {/* Case List */}
          <div className="flex-1 overflow-y-auto">
            {casesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-linear-warning" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-6 text-center text-sm text-linear-text-tertiary">
                {searchQuery ? 'Nu s-au găsit dosare' : 'Nu aveți dosare disponibile'}
              </div>
            ) : (
              <div className="py-1">
                {filteredCases.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => handleCaseSelect(caseItem.id)}
                    disabled={loading}
                    className={clsx(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left',
                      'hover:bg-linear-warning/10 transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      selectedCaseId === caseItem.id && loading && 'bg-linear-warning/10'
                    )}
                  >
                    <Folder className="h-4 w-4 text-linear-warning mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-linear-text-primary truncate">
                        {caseItem.caseNumber || 'Fără număr'}
                      </p>
                      <p className="text-xs text-linear-text-tertiary truncate">{caseItem.title}</p>
                      {caseItem.client?.name && (
                        <p className="text-xs text-linear-text-muted truncate mt-0.5">
                          {caseItem.client.name}
                        </p>
                      )}
                    </div>
                    {selectedCaseId === caseItem.id && loading && (
                      <Loader2 className="h-4 w-4 animate-spin text-linear-warning flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

CasePickerDropup.displayName = 'CasePickerDropup';

export default CasePickerDropup;
