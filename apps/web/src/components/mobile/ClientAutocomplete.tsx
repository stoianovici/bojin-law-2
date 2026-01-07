'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientSearch } from '@/hooks/mobile/useClientSearch';

export interface Client {
  id: string;
  name: string;
  contactInfo: string;
  address: string;
}

interface ClientAutocompleteProps {
  value: Client | null;
  onChange: (client: Client | null) => void;
  label?: string;
  error?: string;
  onCreateNew?: () => void;
}

export function ClientAutocomplete({
  value,
  onChange,
  label,
  error,
  onCreateNew,
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
    <div className="space-y-2">
      {label && (
        <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
      )}
      <div className="relative" ref={containerRef}>
        {/* Input container */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-3.5 rounded-[12px]',
            'bg-mobile-bg-elevated border',
            'transition-colors',
            error
              ? 'border-red-500/50 focus-within:border-red-500'
              : 'border-mobile-border focus-within:border-mobile-accent'
          )}
        >
          <Search
            className="w-[18px] h-[18px] text-mobile-text-tertiary flex-shrink-0"
            strokeWidth={2}
          />
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => {
              if (inputValue.length >= 2 && clients.length > 0) {
                setShowDropdown(true);
              }
            }}
            placeholder="Cauta client..."
            className={cn(
              'flex-1 bg-transparent text-[15px] text-mobile-text-primary',
              'placeholder:text-mobile-text-tertiary outline-none'
            )}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 p-1 -m-1 text-mobile-text-tertiary hover:text-mobile-text-secondary transition-colors"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            className={cn(
              'absolute left-0 right-0 top-full mt-1 z-50',
              'bg-zinc-900/95 backdrop-blur-sm',
              'rounded-[12px] shadow-lg',
              'max-h-[240px] overflow-y-auto',
              'border border-mobile-border'
            )}
          >
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2
                  className="w-5 h-5 text-mobile-text-tertiary animate-spin"
                  strokeWidth={2}
                />
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
                    'w-full text-left py-3 px-4',
                    'hover:bg-mobile-bg-hover transition-colors',
                    'border-b border-mobile-border last:border-b-0'
                  )}
                >
                  <p className="text-[15px] font-medium text-mobile-text-primary">{client.name}</p>
                  {client.address && (
                    <p className="text-[13px] text-mobile-text-secondary mt-0.5">
                      {client.address}
                    </p>
                  )}
                </button>
              ))}

            {/* Empty state */}
            {!loading && clients.length === 0 && (
              <div className="py-4 px-4 text-center">
                <p className="text-[14px] text-mobile-text-tertiary">Niciun client gasit</p>
              </div>
            )}

            {/* Create new option */}
            {onCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className={cn(
                  'w-full text-left py-3 px-4',
                  'text-mobile-accent font-medium text-[15px]',
                  'border-t border-mobile-border',
                  'hover:bg-mobile-bg-hover transition-colors'
                )}
              >
                + Creează client nou
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
