'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseTypeOption {
  value: string;
  label: string;
}

interface CaseTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CaseTypeOption[];
  onAddNew?: (newType: { value: string; label: string }) => void;
  placeholder?: string;
  error?: boolean;
  errorMessage?: string;
  className?: string;
}

/**
 * CaseTypeSelect component
 * Dropdown that allows selecting existing case types or adding new ones
 */
export function CaseTypeSelect({
  value,
  onChange,
  options,
  onAddNew,
  placeholder = 'Selectează tipul',
  error,
  errorMessage,
  className,
}: CaseTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
        setNewTypeLabel('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when adding new
  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
  };

  const handleConfirmNew = () => {
    if (newTypeLabel.trim()) {
      // Generate a code from the label (lowercase, replace spaces with underscores)
      const code = newTypeLabel.trim().toLowerCase().replace(/\s+/g, '_');

      onAddNew?.({ value: code, label: newTypeLabel.trim() });
      onChange(code);
      setNewTypeLabel('');
      setIsAddingNew(false);
      setIsOpen(false);
    }
  };

  const handleCancelNew = () => {
    setNewTypeLabel('');
    setIsAddingNew(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmNew();
    } else if (e.key === 'Escape') {
      handleCancelNew();
    }
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full h-10 px-3 rounded-md border bg-linear-bg-elevated',
          'text-sm transition-colors',
          error
            ? 'border-linear-error'
            : 'border-linear-border-subtle focus:border-transparent focus:ring-2 focus:ring-linear-accent',
          isOpen && 'ring-2 ring-linear-accent border-transparent'
        )}
      >
        <span
          className={cn(selectedOption ? 'text-linear-text-primary' : 'text-linear-text-muted')}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-linear-text-muted transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-linear-bg-elevated border border-linear-border-subtle rounded-md shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* Existing options */}
            {options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2.5 text-sm text-left',
                    'hover:bg-linear-bg-tertiary transition-colors',
                    value === option.value && 'bg-linear-accent/10 text-linear-accent'
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="w-4 h-4" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-linear-text-tertiary">
                Nu există tipuri definite
              </div>
            )}
          </div>

          {/* Add new section */}
          {onAddNew && (
            <div className="border-t border-linear-border-subtle">
              {isAddingNew ? (
                <div className="p-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newTypeLabel}
                      onChange={(e) => setNewTypeLabel(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Nume tip nou..."
                      className="flex-1 h-9 px-3 text-sm rounded-md border border-linear-border-subtle bg-linear-bg-primary text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-2 focus:ring-linear-accent focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmNew}
                      disabled={!newTypeLabel.trim()}
                      className="p-2 rounded-md bg-linear-accent text-white hover:bg-linear-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelNew}
                      className="p-2 rounded-md text-linear-text-tertiary hover:text-linear-text-primary hover:bg-linear-bg-tertiary transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-linear-accent hover:bg-linear-bg-tertiary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Adaugă tip nou
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && errorMessage && <p className="mt-1.5 text-xs text-linear-error">{errorMessage}</p>}
    </div>
  );
}
