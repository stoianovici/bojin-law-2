'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientSearch, type Client } from '@/hooks/mobile/useClientSearch';

export type { Client };

interface ClientAutocompleteProps {
  value: Client | null;
  onChange: (client: Client | null) => void;
  label?: string;
  error?: string;
  onCreateNew?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Desktop ClientAutocomplete component
 * Search dropdown with 2+ character threshold for client search
 */
export function ClientAutocomplete({
  value,
  onChange,
  label,
  error,
  onCreateNew,
  disabled = false,
  className,
}: ClientAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { clients, loading, search } = useClientSearch();

  // Debounced search
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Only search after 2+ characters with 300ms debounce
      if (newValue.length >= 2) {
        debounceRef.current = setTimeout(() => {
          search(newValue);
          setShowDropdown(true);
        }, 300);
      } else {
        setShowDropdown(false);
      }
    },
    [search]
  );

  // Handle client selection
  const handleSelectClient = useCallback(
    (client: Client) => {
      onChange(client);
      setInputValue(client.name);
      setShowDropdown(false);
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue('');
    setShowDropdown(false);
  }, [onChange]);

  // Handle create new
  const handleCreateNew = useCallback(() => {
    setShowDropdown(false);
    onCreateNew?.();
  }, [onCreateNew]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Sync input value with external value changes
  useEffect(() => {
    if (value) {
      setInputValue(value.name);
    }
  }, [value]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium text-linear-text-secondary">{label}</label>}
      <div className="relative" ref={containerRef}>
        {/* Input container */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 h-10 rounded-md',
            'bg-linear-bg-elevated border',
            'transition-colors',
            error
              ? 'border-linear-error'
              : 'border-linear-border-subtle focus-within:border-transparent focus-within:ring-2 focus-within:ring-linear-accent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Search className="w-4 h-4 text-linear-text-muted flex-shrink-0" />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              if (inputValue.length >= 2 && clients.length > 0) {
                setShowDropdown(true);
              }
            }}
            placeholder="Caută client..."
            disabled={disabled}
            className={cn(
              'flex-1 bg-transparent text-sm text-linear-text-primary',
              'placeholder:text-linear-text-muted outline-none',
              'disabled:cursor-not-allowed'
            )}
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-linear-text-muted animate-spin flex-shrink-0" />
          )}
          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="flex-shrink-0 p-1 -m-1 text-linear-text-muted hover:text-linear-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            className={cn(
              'absolute left-0 right-0 top-full mt-1 z-50',
              'bg-linear-bg-elevated',
              'rounded-md shadow-lg',
              'max-h-[280px] overflow-y-auto',
              'border border-linear-border-subtle'
            )}
          >
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-linear-text-muted animate-spin" />
              </div>
            )}

            {/* Client results */}
            {!loading &&
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className={cn(
                    'w-full text-left py-2.5 px-3',
                    'hover:bg-linear-bg-tertiary transition-colors',
                    'border-b border-linear-border-subtle last:border-b-0'
                  )}
                >
                  <p className="text-sm font-medium text-linear-text-primary">{client.name}</p>
                  {client.address && (
                    <p className="text-xs text-linear-text-tertiary mt-0.5">{client.address}</p>
                  )}
                </button>
              ))}

            {/* Empty state */}
            {!loading && clients.length === 0 && (
              <div className="py-4 px-3 text-center">
                <p className="text-sm text-linear-text-tertiary">Niciun client găsit</p>
              </div>
            )}

            {/* Create new option */}
            {onCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className={cn(
                  'w-full flex items-center gap-2 py-2.5 px-3',
                  'text-linear-accent text-sm font-medium',
                  'border-t border-linear-border-subtle',
                  'hover:bg-linear-bg-tertiary transition-colors'
                )}
              >
                <Plus className="w-4 h-4" />
                Creează client nou
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-linear-error">{error}</p>}
    </div>
  );
}
