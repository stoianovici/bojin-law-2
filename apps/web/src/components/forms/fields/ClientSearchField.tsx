'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLazyQuery } from '@apollo/client/react';
import { Search, X, Loader2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEARCH_CLIENTS } from '@/graphql/queries';

interface ClientOption {
  id: string;
  name: string;
}

interface SearchClientResult {
  id: string;
  name: string;
  contactInfo: Record<string, unknown>;
}

interface SearchClientsData {
  searchClients: SearchClientResult[];
}

interface ClientSearchFieldProps {
  value: ClientOption | null;
  onChange: (clientOption: ClientOption | null) => void;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

export function ClientSearchField({
  value,
  onChange,
  error = false,
  errorMessage,
  required = false,
  label,
  placeholder = 'Căutați clienți...',
}: ClientSearchFieldProps) {
  const [focused, setFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [searchClients, { data, loading }] = useLazyQuery<SearchClientsData>(SEARCH_CLIENTS, {
    fetchPolicy: 'network-only',
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length > 0) {
      searchClients({
        variables: {
          query: debouncedQuery,
          limit: 10,
        },
      });
    }
  }, [debouncedQuery, searchClients]);

  // Update dropdown position when focused
  useEffect(() => {
    if (focused && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [focused, searchQuery]);

  const handleSelect = useCallback(
    (clientItem: SearchClientResult) => {
      onChange({
        id: clientItem.id,
        name: clientItem.name,
      });
      setSearchQuery('');
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onChange(null);
      setSearchQuery('');
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      setFocused(false);
    }, 200);
  }, []);

  const clients = data?.searchClients ?? [];
  const showDropdown = focused && searchQuery.trim().length > 0;

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-linear-text-primary">
          {label}
          {required && <span className="ml-0.5 text-linear-error">*</span>}
        </label>
      )}
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            'relative flex h-8 w-full items-center rounded-md border bg-linear-bg-elevated px-3 text-sm transition-colors duration-150',
            focused && 'border-transparent outline-none ring-2 ring-linear-accent',
            !focused && (error ? 'border-linear-error' : 'border-linear-border-subtle')
          )}
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0 text-linear-text-muted" />
          {value && !focused ? (
            <span
              className="flex-1 truncate text-linear-text-primary cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {value.name}
            </span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={value ? value.name : placeholder}
              className={cn(
                'flex-1 bg-transparent outline-none text-linear-text-primary',
                'placeholder:text-linear-text-muted'
              )}
            />
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-linear-text-muted" />}
          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-2 rounded p-0.5 text-linear-text-muted transition-colors hover:bg-linear-bg-tertiary hover:text-linear-text-primary"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown rendered via portal to escape overflow clipping */}
        {showDropdown &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed z-[9999] bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg overflow-hidden"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
            >
              {loading && clients.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-sm text-linear-text-muted">
                  Se caută...
                </div>
              ) : clients.length === 0 ? (
                <div className="py-4 text-center text-sm text-linear-text-muted">
                  Niciun client găsit
                </div>
              ) : (
                <ul className="max-h-60 overflow-y-auto py-1">
                  {clients.map((clientItem) => (
                    <li key={clientItem.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(clientItem);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                          'hover:bg-linear-bg-tertiary',
                          value?.id === clientItem.id && 'bg-linear-bg-tertiary'
                        )}
                      >
                        <Building2 className="h-4 w-4 text-linear-text-muted shrink-0" />
                        <span className="font-medium text-linear-text-primary truncate">
                          {clientItem.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body
          )}
      </div>
      {error && errorMessage && <p className="mt-1.5 text-xs text-linear-error">{errorMessage}</p>}
    </div>
  );
}
