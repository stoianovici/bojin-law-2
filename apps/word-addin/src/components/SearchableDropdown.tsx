/**
 * SearchableDropdown Component
 * A searchable dropdown/combobox for selecting items from a list.
 * Supports keyboard navigation, filtering, and grouped options (tree-style).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DropdownOption {
  id: string;
  label: string;
  /** Optional secondary label shown in smaller text */
  secondary?: string;
  /** Optional group name - items with same group are grouped under a header */
  group?: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string, option?: DropdownOption) => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  /** Shown when there are no options */
  emptyMessage?: string;
  /** Input placeholder when filtering */
  searchPlaceholder?: string;
}

/** Internal type for rendering - either a group header or an option */
type RenderItem =
  | { type: 'group'; name: string }
  | { type: 'option'; option: DropdownOption; index: number };

// ============================================================================
// Component
// ============================================================================

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Selectați...',
  isLoading = false,
  disabled = false,
  emptyMessage = 'Nu există opțiuni',
  searchPlaceholder = 'Căutare...',
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const selectedOption = useMemo(() => options.find((opt) => opt.id === value), [options, value]);

  // Filter options by search text
  const filteredOptions = useMemo(() => {
    if (!searchText.trim()) return options;
    const query = searchText.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.secondary?.toLowerCase().includes(query) ||
        opt.group?.toLowerCase().includes(query)
    );
  }, [options, searchText]);

  // Build render items (groups + options)
  const renderItems = useMemo(() => {
    const items: RenderItem[] = [];
    let currentGroup: string | undefined;
    let optionIndex = 0;

    for (const option of filteredOptions) {
      // Add group header if group changed
      if (option.group !== currentGroup) {
        currentGroup = option.group;
        if (currentGroup) {
          items.push({ type: 'group', name: currentGroup });
        }
      }
      items.push({ type: 'option', option, index: optionIndex });
      optionIndex++;
    }

    return items;
  }, [filteredOptions]);

  // Compute initial highlight index based on filtered options
  const initialHighlightIndex = useMemo(
    () => (filteredOptions.length > 0 ? 0 : -1),
    [filteredOptions.length]
  );

  // Reset highlight when search text changes (clear and re-focus)
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(initialHighlightIndex);
    }
  }, [searchText, isOpen, initialHighlightIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchText('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.dropdown-option');
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleOpen = useCallback(() => {
    if (disabled || isLoading) return;
    setIsOpen(true);
    setSearchText('');
    setHighlightedIndex(0);
    // Focus input after dropdown opens
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled, isLoading]);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      onChange(option.id, option);
      setIsOpen(false);
      setSearchText('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          handleOpen();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchText('');
          break;

        case 'Tab':
          setIsOpen(false);
          setSearchText('');
          break;
      }
    },
    [isOpen, highlightedIndex, filteredOptions, handleOpen, handleSelect]
  );

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="searchable-dropdown disabled">
        <div className="dropdown-trigger">
          <span className="dropdown-placeholder">Se încarcă...</span>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="searchable-dropdown disabled">
        <div className="dropdown-trigger">
          <span className="dropdown-placeholder">{emptyMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`searchable-dropdown ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button - shows selected value or placeholder */}
      <button
        type="button"
        className="dropdown-trigger"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedOption ? (
          <span className="dropdown-value">
            {selectedOption.group && (
              <span className="dropdown-value-group">{selectedOption.group} / </span>
            )}
            {selectedOption.label}
          </span>
        ) : (
          <span className="dropdown-placeholder">{placeholder}</span>
        )}
        <ChevronIcon isOpen={isOpen} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="dropdown-menu">
          {/* Search input */}
          <div className="dropdown-search">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              className="dropdown-search-input"
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              autoComplete="off"
            />
            {searchText && (
              <button
                type="button"
                className="dropdown-search-clear"
                onClick={() => setSearchText('')}
                tabIndex={-1}
              >
                <ClearIcon />
              </button>
            )}
          </div>

          {/* Options list */}
          <div ref={listRef} className="dropdown-options" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="dropdown-no-results">
                Niciun rezultat pentru &ldquo;{searchText}&rdquo;
              </div>
            ) : (
              renderItems.map((item, idx) =>
                item.type === 'group' ? (
                  <div key={`group-${item.name}-${idx}`} className="dropdown-group-header">
                    <ClientIcon />
                    <span>{item.name}</span>
                  </div>
                ) : (
                  <div
                    key={item.option.id}
                    className={`dropdown-option ${
                      item.option.id === value ? 'selected' : ''
                    } ${item.index === highlightedIndex ? 'highlighted' : ''} ${
                      item.option.group ? 'grouped' : ''
                    }`}
                    onClick={() => handleSelect(item.option)}
                    onMouseEnter={() => setHighlightedIndex(item.index)}
                    role="option"
                    aria-selected={item.option.id === value}
                  >
                    <span className="option-label">{item.option.label}</span>
                    {item.option.secondary && (
                      <span className="option-secondary">{item.option.secondary}</span>
                    )}
                    {item.option.id === value && <CheckIcon />}
                  </div>
                )
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`dropdown-chevron ${isOpen ? 'open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="search-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="check-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClientIcon() {
  return (
    <svg
      className="group-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="loading-spinner"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}
