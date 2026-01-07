'use client';

/**
 * EditableCell Component
 * Reusable inline edit component for timesheet cells
 *
 * Features:
 * - Click to enter edit mode
 * - Blur or Enter to save
 * - Escape to cancel
 * - Number input with validation
 * - Visual feedback (spinner, success flash, error shake)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface EditableCellProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  formatDisplay: (value: number) => string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}

type CellState = 'idle' | 'editing' | 'saving' | 'success' | 'error';

// ============================================================================
// Component
// ============================================================================

export function EditableCell({
  value,
  onSave,
  formatDisplay,
  min = 0,
  max = 999999,
  step = 0.01,
  suffix,
  disabled = false,
  className,
}: EditableCellProps) {
  const [state, setState] = useState<CellState>('idle');
  const [editValue, setEditValue] = useState<string>(value.toString());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset edit value when external value changes
  useEffect(() => {
    if (state === 'idle') {
      setEditValue(value.toString());
    }
  }, [value, state]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (state === 'editing' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [state]);

  // Clear success/error state after delay
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timer = setTimeout(
        () => {
          setState('idle');
          setErrorMessage(null);
        },
        state === 'success' ? 800 : 2000
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  const enterEditMode = useCallback(() => {
    if (disabled) return;
    setEditValue(value.toString());
    setState('editing');
  }, [disabled, value]);

  const cancelEdit = useCallback(() => {
    setEditValue(value.toString());
    setState('idle');
    setErrorMessage(null);
  }, [value]);

  const saveEdit = useCallback(async () => {
    const numValue = parseFloat(editValue);

    // Validation
    if (isNaN(numValue)) {
      setErrorMessage('Valoare invalidă');
      setState('error');
      return;
    }

    if (numValue < min) {
      setErrorMessage(`Minim: ${min}`);
      setState('error');
      return;
    }

    if (numValue > max) {
      setErrorMessage(`Maxim: ${max}`);
      setState('error');
      return;
    }

    // No change - just close
    if (numValue === value) {
      setState('idle');
      return;
    }

    setState('saving');

    try {
      await onSave(numValue);
      setState('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Eroare la salvare');
      setState('error');
      // Restore original value on error
      setEditValue(value.toString());
    }
  }, [editValue, min, max, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit]
  );

  const handleBlur = useCallback(() => {
    if (state === 'editing') {
      saveEdit();
    }
  }, [state, saveEdit]);

  // ============================================================================
  // Render
  // ============================================================================

  // Display mode (idle, saving, success, error)
  if (state !== 'editing') {
    return (
      <button
        type="button"
        onClick={enterEditMode}
        disabled={disabled || state === 'saving'}
        className={clsx(
          'text-sm text-right font-medium tabular-nums transition-all duration-200',
          'px-2 py-1 -mx-2 -my-1 rounded cursor-pointer',
          'hover:bg-linear-bg-tertiary focus:outline-none focus:ring-2 focus:ring-linear-accent/50',
          disabled && 'cursor-default opacity-50 hover:bg-transparent',
          state === 'saving' && 'cursor-wait opacity-75',
          state === 'success' && 'bg-linear-success/20 text-linear-success',
          state === 'error' && 'bg-linear-error/20 text-linear-error',
          className
        )}
        title={errorMessage || undefined}
      >
        <span className="flex items-center justify-end gap-1">
          {state === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-linear-text-muted" />}
          <span>{formatDisplay(value)}</span>
          {suffix && <span className="text-linear-text-muted">{suffix}</span>}
        </span>
      </button>
    );
  }

  // Edit mode
  return (
    <div className={clsx('relative', className)}>
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        className={clsx(
          'w-full text-sm text-right font-medium tabular-nums',
          'px-2 py-1 rounded border border-linear-accent',
          'focus:outline-none focus:ring-2 focus:ring-linear-accent/50',
          'bg-linear-bg-secondary shadow-sm text-linear-text-primary',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        )}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-linear-text-muted pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

EditableCell.displayName = 'EditableCell';

export default EditableCell;
