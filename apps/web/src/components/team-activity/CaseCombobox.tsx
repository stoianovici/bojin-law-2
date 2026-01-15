'use client';

/**
 * CaseCombobox Component
 * A combobox for selecting a case in modal contexts.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Folder, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useMyCases } from '../../hooks/useMyCases';

// ============================================================================
// Types
// ============================================================================

export interface CaseComboboxProps {
  /** Currently selected case ID */
  value: string | null;
  /** Called when a case is selected */
  onChange: (caseId: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Disables all interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when no case selected */
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CaseCombobox({
  value,
  onChange,
  required = false,
  disabled = false,
  className,
  placeholder = 'Selectează dosar...',
}: CaseComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { cases, loading: casesLoading } = useMyCases();

  // Find selected case for display
  const selectedCase = useMemo(() => {
    if (!value) return null;
    return cases.find((c) => c.id === value) || null;
  }, [cases, value]);

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;

    const query = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.referenceNumbers?.[0]?.toLowerCase().includes(query) ||
        c.client?.name?.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  // Reset highlighted index when filtered cases change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCases.length]);

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const highlightedElement = listRef.current.querySelector(
      `[data-index="${highlightedIndex}"]`
    ) as HTMLElement;

    if (highlightedElement) {
      highlightedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [disabled, isOpen]);

  const handleCaseSelect = useCallback(
    (caseId: string) => {
      if (disabled) return;
      setIsOpen(false);
      setSearchQuery('');
      onChange(caseId);
    },
    [disabled, onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          break;
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredCases.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredCases[highlightedIndex]) {
            handleCaseSelect(filteredCases[highlightedIndex].id);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          setSearchQuery('');
          break;
      }
    },
    [isOpen, filteredCases, highlightedIndex, handleCaseSelect]
  );

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2.5',
          'border rounded-lg text-sm transition-all',
          'bg-linear-bg-secondary',
          isOpen
            ? 'border-linear-accent ring-2 ring-linear-accent/20'
            : 'border-linear-border-subtle hover:border-linear-border',
          disabled && 'opacity-50 cursor-not-allowed bg-linear-bg-tertiary',
          !selectedCase && 'text-linear-text-muted'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Folder className="h-4 w-4 text-linear-accent flex-shrink-0" />
          {selectedCase ? (
            <div className="min-w-0 flex-1 text-left">
              <span className="text-linear-text-primary truncate block">{selectedCase.title}</span>
            </div>
          ) : (
            <span className="text-linear-text-muted">
              {placeholder}
              {required && <span className="text-linear-error ml-1">*</span>}
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-linear-text-muted transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            'absolute top-full left-0 mt-1 w-full max-h-72',
            'bg-linear-bg-secondary rounded-lg shadow-lg border border-linear-border-subtle',
            'animate-in fade-in-0 slide-in-from-top-2 duration-150',
            'flex flex-col overflow-hidden z-50'
          )}
          role="listbox"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-linear-border-subtle/50 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-linear-text-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Caută dosar..."
                className={clsx(
                  'w-full pl-9 pr-3 py-2 text-sm',
                  'border border-linear-border-subtle rounded-md',
                  'bg-linear-bg-secondary text-linear-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent'
                )}
              />
            </div>
          </div>

          {/* Case List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {casesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-linear-accent" />
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-6 text-center text-sm text-linear-text-muted">
                {searchQuery ? 'Nu s-au găsit dosare' : 'Nu aveți dosare disponibile'}
              </div>
            ) : (
              <div className="py-1">
                {filteredCases.map((caseItem, index) => {
                  const isSelected = caseItem.id === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={caseItem.id}
                      type="button"
                      data-index={index}
                      onClick={() => handleCaseSelect(caseItem.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={clsx(
                        'w-full flex items-start gap-3 px-3 py-2.5 text-left',
                        'transition-colors',
                        isHighlighted && 'bg-linear-accent/10',
                        isSelected && 'bg-linear-accent/15'
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <Folder className="h-4 w-4 text-linear-accent mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-linear-text-primary truncate">
                          {caseItem.title}
                        </p>
                        <p className="text-xs text-linear-text-muted truncate">
                          {caseItem.referenceNumbers?.[0] && <span>{caseItem.referenceNumbers[0]}</span>}
                          {caseItem.referenceNumbers?.[0] && caseItem.client?.name && <span> · </span>}
                          {caseItem.client?.name && <span>{caseItem.client.name}</span>}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-linear-accent flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

CaseCombobox.displayName = 'CaseCombobox';

export default CaseCombobox;
