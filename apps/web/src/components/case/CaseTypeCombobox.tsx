'use client';

/**
 * CaseTypeCombobox Component
 * OPS-270: Searchable case type picker
 *
 * A combobox for selecting case types with search capability.
 * Similar to CaseCombobox but for case types.
 *
 * Features:
 * - Controlled component (value + onChange)
 * - Search input always visible when open
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Partners can create new types inline
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Tag, Loader2, Check, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useCaseTypes } from '../../hooks/useCaseTypes';

// ============================================================================
// Types
// ============================================================================

export interface CaseTypeComboboxProps {
  /** Currently selected case type code */
  value: string | null;
  /** Called when a case type is selected */
  onChange: (typeCode: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Disables all interactions */
  disabled?: boolean;
  /** Whether user can create new types (Partners only) */
  canCreate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when no type selected */
  placeholder?: string;
  /** Validation error message */
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CaseTypeCombobox({
  value,
  onChange,
  required = false,
  disabled = false,
  canCreate = false,
  className,
  placeholder = 'Selectează tip dosar...',
  error,
}: CaseTypeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { caseTypes, loading: typesLoading, createCaseType, createLoading } = useCaseTypes();

  // Find selected case type for display
  const selectedType = useMemo(() => {
    if (!value) return null;
    return caseTypes.find((ct) => ct.code === value) || null;
  }, [caseTypes, value]);

  // Filter case types based on search query
  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return caseTypes;

    const query = searchQuery.toLowerCase();
    return caseTypes.filter(
      (ct) => ct.name.toLowerCase().includes(query) || ct.code.toLowerCase().includes(query)
    );
  }, [caseTypes, searchQuery]);

  // Reset highlighted index when search query changes
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setHighlightedIndex(0);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setShowCreateForm(false);
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

  // Helper to generate code from name
  const generateCodeFromName = (name: string) =>
    name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

  const handleTypeNameChange = (name: string) => {
    setNewTypeName(name);
    if (name) {
      setNewTypeCode(generateCodeFromName(name));
    }
  };

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setShowCreateForm(false);
    }
  }, [disabled, isOpen]);

  const handleTypeSelect = useCallback(
    (typeCode: string) => {
      if (disabled) return;
      setIsOpen(false);
      setSearchQuery('');
      setShowCreateForm(false);
      onChange(typeCode);
    },
    [disabled, onChange]
  );

  const handleCreateType = useCallback(async () => {
    if (!newTypeName.trim() || !newTypeCode.trim()) return;

    const result = await createCaseType(newTypeName.trim(), newTypeCode.trim());
    if (result.success && result.caseType) {
      // Auto-select the new type
      onChange(result.caseType.code);
      setIsOpen(false);
      setSearchQuery('');
      setShowCreateForm(false);
      setNewTypeName('');
      setNewTypeCode('');
    }
  }, [newTypeName, newTypeCode, createCaseType, onChange]);

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
          if (showCreateForm) {
            setShowCreateForm(false);
          } else {
            setIsOpen(false);
            setSearchQuery('');
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (!showCreateForm) {
            setHighlightedIndex((prev) => (prev < filteredTypes.length - 1 ? prev + 1 : prev));
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!showCreateForm) {
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (!showCreateForm && filteredTypes[highlightedIndex]) {
            handleTypeSelect(filteredTypes[highlightedIndex].code);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          setSearchQuery('');
          setShowCreateForm(false);
          break;
      }
    },
    [isOpen, filteredTypes, highlightedIndex, handleTypeSelect, showCreateForm]
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
          'w-full flex items-center justify-between gap-2 px-3 py-2',
          'border rounded-md text-sm transition-all',
          'bg-white',
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : error
              ? 'border-red-300'
              : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          !selectedType && 'text-gray-400'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
          {selectedType ? (
            <span className="text-gray-900 truncate">{selectedType.name}</span>
          ) : (
            <span className="text-gray-400">
              {placeholder}
              {required && <span className="text-red-500 ml-1">*</span>}
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Error Message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            'absolute top-full left-0 mt-1 w-full max-h-80',
            'bg-white rounded-lg shadow-lg border border-gray-200',
            'animate-in fade-in-0 slide-in-from-top-2 duration-150',
            'flex flex-col overflow-hidden z-50'
          )}
          role="listbox"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Caută tip dosar..."
                className={clsx(
                  'w-full pl-9 pr-3 py-2 text-sm',
                  'border border-gray-200 rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
              />
            </div>
          </div>

          {/* Type List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {typesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {searchQuery ? 'Nu s-au găsit tipuri de dosar' : 'Nu există tipuri de dosar'}
              </div>
            ) : (
              <div className="py-1">
                {filteredTypes.map((typeItem, index) => {
                  const isSelected = typeItem.code === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={typeItem.code}
                      type="button"
                      data-index={index}
                      onClick={() => handleTypeSelect(typeItem.code)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2.5 text-left',
                        'transition-colors',
                        isHighlighted && 'bg-blue-50',
                        isSelected && 'bg-blue-100'
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{typeItem.name}</p>
                        <p className="text-xs text-gray-500">{typeItem.code}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create New Type Section (Partners only) */}
          {canCreate && (
            <div className="border-t border-gray-100 flex-shrink-0">
              {showCreateForm ? (
                <div className="p-3 space-y-3 bg-gray-50">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nume tip nou
                    </label>
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => handleTypeNameChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ex: Insolvență"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cod (generat automat)
                    </label>
                    <input
                      type="text"
                      value={newTypeCode}
                      onChange={(e) =>
                        setNewTypeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100"
                      placeholder="INSOLVENTA"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTypeName('');
                        setNewTypeCode('');
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Anulează
                    </button>
                    <button
                      type="button"
                      disabled={!newTypeName.trim() || !newTypeCode.trim() || createLoading}
                      onClick={handleCreateType}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {createLoading && (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      )}
                      Salvează
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adaugă tip nou</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CaseTypeCombobox.displayName = 'CaseTypeCombobox';

export default CaseTypeCombobox;
