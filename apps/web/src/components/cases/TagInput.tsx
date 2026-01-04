'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  validate?: (tag: string) => boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Desktop TagInput component
 * Chip-style input for keywords, domains, etc.
 * Enter key or comma adds tag, X button removes
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'Add tag...',
  label,
  error,
  validate,
  disabled = false,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;

      // Check for duplicates
      if (value.includes(trimmed)) {
        setInputValue('');
        return;
      }

      // Validate if validator provided
      if (validate && !validate(trimmed)) {
        return;
      }

      onChange([...value, trimmed]);
      setInputValue('');
    },
    [value, onChange, validate]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    },
    [value, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <label className="text-sm font-medium text-linear-text-secondary">{label}</label>}

      <div
        className={cn(
          'flex flex-wrap gap-2 p-2 rounded-md border bg-linear-bg-elevated min-h-[40px]',
          error ? 'border-linear-error' : 'border-linear-border-subtle',
          'focus-within:ring-2 focus-within:border-transparent',
          error ? 'focus-within:ring-linear-error' : 'focus-within:ring-linear-accent'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-linear-bg-tertiary text-linear-text-secondary"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="p-0.5 rounded-full hover:bg-linear-bg-hover text-linear-text-muted hover:text-linear-text-primary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {error && <p className="text-xs text-linear-error">{error}</p>}
    </div>
  );
}
