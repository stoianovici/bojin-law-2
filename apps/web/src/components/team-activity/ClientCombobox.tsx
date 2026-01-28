'use client';

/**
 * ClientCombobox Component
 * A combobox for selecting a client in modal contexts.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Building2, Loader2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery } from '@apollo/client/react';
import { GET_CLIENTS } from '../../graphql/queries';

// ============================================================================
// Types
// ============================================================================

interface Client {
  id: string;
  name: string;
  clientType: string | null;
  email: string | null;
}

interface GetClientsResponse {
  clients: Client[];
}

export interface ClientComboboxProps {
  /** Currently selected client ID */
  value: string | null;
  /** Called when a client is selected */
  onChange: (clientId: string) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Disables all interactions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text when no client selected */
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ClientCombobox({
  value,
  onChange,
  required = false,
  disabled = false,
  className,
  placeholder = 'Selectează client...',
}: ClientComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, loading: clientsLoading } = useQuery<GetClientsResponse>(GET_CLIENTS);
  const clients = data?.clients || [];

  // Find selected client for display
  const selectedClient = useMemo(() => {
    if (!value) return null;
    return clients.find((c) => c.id === value) || null;
  }, [clients, value]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(query) || c.email?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // Reset highlighted index when filtered clients change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredClients.length]);

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

  const handleClientSelect = useCallback(
    (clientId: string) => {
      if (disabled) return;
      setIsOpen(false);
      setSearchQuery('');
      onChange(clientId);
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
          setHighlightedIndex((prev) => (prev < filteredClients.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredClients[highlightedIndex]) {
            handleClientSelect(filteredClients[highlightedIndex].id);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          setSearchQuery('');
          break;
      }
    },
    [isOpen, filteredClients, highlightedIndex, handleClientSelect]
  );

  // Get client type label
  const getClientTypeLabel = (clientType: string | null): string => {
    switch (clientType) {
      case 'Company':
        return 'Companie';
      case 'Individual':
        return 'Persoană fizică';
      default:
        return '';
    }
  };

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
          !selectedClient && 'text-linear-text-muted'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 className="h-4 w-4 text-linear-accent flex-shrink-0" />
          {selectedClient ? (
            <div className="min-w-0 flex-1 text-left">
              <span className="text-linear-text-primary truncate block">{selectedClient.name}</span>
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
                placeholder="Caută client..."
                className={clsx(
                  'w-full pl-9 pr-3 py-2 text-sm',
                  'border border-linear-border-subtle rounded-md',
                  'bg-linear-bg-secondary text-linear-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent'
                )}
              />
            </div>
          </div>

          {/* Client List */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {clientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-linear-accent" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-6 text-center text-sm text-linear-text-muted">
                {searchQuery ? 'Nu s-au găsit clienți' : 'Nu aveți clienți disponibili'}
              </div>
            ) : (
              <div className="py-1">
                {filteredClients.map((client, index) => {
                  const isSelected = client.id === value;
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      data-index={index}
                      onClick={() => handleClientSelect(client.id)}
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
                      <Building2 className="h-4 w-4 text-linear-accent mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-linear-text-primary truncate">
                          {client.name}
                        </p>
                        {client.clientType && (
                          <p className="text-xs text-linear-text-muted truncate">
                            {getClientTypeLabel(client.clientType)}
                          </p>
                        )}
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

ClientCombobox.displayName = 'ClientCombobox';

export default ClientCombobox;
