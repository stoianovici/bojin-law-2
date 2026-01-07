'use client';

import { useState, KeyboardEvent, ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  validate?: (tag: string) => boolean;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = 'Adăugați etichetă...',
  label,
  error,
  validate,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();

    // Skip empty tags
    if (!trimmedTag) return;

    // Check for duplicates
    if (value.includes(trimmedTag)) return;

    // Run custom validation if provided
    if (validate && !validate(trimmedTag)) return;

    onChange([...value, trimmedTag]);
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(value[value.length - 1]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Check for comma to add tag
    if (newValue.includes(',')) {
      const parts = newValue.split(',');
      // Add all complete tags (everything before the last comma)
      parts.slice(0, -1).forEach((part) => addTag(part));
      // Keep the part after the last comma in the input
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(newValue);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-[13px] font-medium text-mobile-text-secondary">{label}</label>
      )}
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 min-h-[48px] px-4 py-2',
          'bg-mobile-bg-elevated border border-mobile-border rounded-[12px]',
          'focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20',
          'transition-colors duration-200',
          error && 'border-red-400'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-[13px] text-mobile-text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="flex items-center justify-center hover:text-red-400 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className={cn(
            'flex-1 min-w-[120px] bg-transparent text-[15px] text-mobile-text-primary',
            'placeholder:text-mobile-text-tertiary',
            'outline-none border-none'
          )}
        />
      </div>
      {error && <p className="text-[13px] text-red-400">{error}</p>}
    </div>
  );
}
