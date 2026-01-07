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
  label?: string;
  placeholder?: string;
  error?: string;
}

/**
 * Mobile CaseTypeSelect component
 * Dropdown that allows selecting existing case types or adding new ones
 */
export function CaseTypeSelect({
  value,
  onChange,
  options,
  onAddNew,
  label,
  placeholder = 'Selectează tipul',
  error,
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
    <div className="space-y-2">
      {label && (
        <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
      )}

      <div className="relative" ref={containerRef}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between w-full px-4 py-3.5 rounded-[12px]',
            'bg-mobile-bg-elevated border',
            'text-[15px] transition-colors',
            error ? 'border-red-500/50' : 'border-mobile-border',
            isOpen && 'border-mobile-accent'
          )}
        >
          <span
            className={cn(
              selectedOption ? 'text-mobile-text-primary' : 'text-mobile-text-tertiary'
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              'w-5 h-5 text-mobile-text-tertiary transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div
            className={cn(
              'absolute left-0 right-0 top-full mt-1 z-50',
              'bg-zinc-900/95 backdrop-blur-sm',
              'rounded-[12px] shadow-lg',
              'max-h-[280px] overflow-y-auto',
              'border border-mobile-border'
            )}
          >
            {/* Existing options */}
            {options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex items-center justify-between w-full px-4 py-3',
                    'text-[15px] text-left',
                    'hover:bg-mobile-bg-hover transition-colors',
                    'border-b border-mobile-border last:border-b-0',
                    value === option.value && 'bg-mobile-accent/10 text-mobile-accent'
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && <Check className="w-5 h-5" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-center text-[14px] text-mobile-text-tertiary">
                Nu există tipuri definite
              </div>
            )}

            {/* Add new section */}
            {onAddNew && (
              <div className="border-t border-mobile-border">
                {isAddingNew ? (
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newTypeLabel}
                        onChange={(e) => setNewTypeLabel(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nume tip nou..."
                        className={cn(
                          'flex-1 px-4 py-3 text-[15px] rounded-lg',
                          'bg-mobile-bg-card border border-mobile-border',
                          'text-mobile-text-primary placeholder:text-mobile-text-tertiary',
                          'focus:outline-none focus:border-mobile-accent'
                        )}
                      />
                      <button
                        type="button"
                        onClick={handleConfirmNew}
                        disabled={!newTypeLabel.trim()}
                        className="p-3 rounded-lg bg-mobile-accent text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelNew}
                        className="p-3 rounded-lg text-mobile-text-tertiary hover:text-mobile-text-primary hover:bg-mobile-bg-hover transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="flex items-center gap-2 w-full px-4 py-3 text-[15px] text-mobile-accent hover:bg-mobile-bg-hover transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Adaugă tip nou
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
