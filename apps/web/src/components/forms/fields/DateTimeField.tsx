'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DateTimeFieldProps {
  date?: string;
  time?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
  label?: string;
}

export function DateTimeField({
  date,
  time,
  onDateChange,
  onTimeChange,
  required = false,
  error = false,
  errorMessage,
  label,
}: DateTimeFieldProps) {
  const inputBaseStyles = cn(
    'flex w-full rounded-md bg-linear-bg-elevated border text-linear-text-primary',
    'placeholder:text-linear-text-muted',
    'focus:outline-none focus:ring-2 focus:border-transparent',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'transition-colors duration-150',
    'h-8 text-sm px-3',
    error
      ? 'border-linear-error focus:ring-linear-error'
      : 'border-linear-border-subtle focus:ring-linear-accent'
  );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-linear-text-primary mb-1.5">
          {label}
          {required && <span className="text-linear-error ml-0.5">*</span>}
        </label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={date ?? ''}
          onChange={(e) => onDateChange(e.target.value)}
          required={required}
          className={cn(inputBaseStyles, 'flex-1')}
          aria-label={label ? `${label} date` : 'Date'}
        />
        <input
          type="time"
          value={time ?? ''}
          onChange={(e) => onTimeChange(e.target.value)}
          required={required}
          className={cn(inputBaseStyles, 'flex-1')}
          aria-label={label ? `${label} time` : 'Time'}
        />
      </div>
      {error && errorMessage && <p className="mt-1.5 text-xs text-linear-error">{errorMessage}</p>}
    </div>
  );
}
