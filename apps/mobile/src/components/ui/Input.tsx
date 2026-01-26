'use client';

import { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================
// Styles
// ============================================

const containerStyles = 'flex flex-col gap-1.5';

const labelStyles = 'text-sm font-medium text-text-secondary';

const inputWrapperStyles = clsx(
  'relative flex items-center',
  'bg-bg-elevated rounded-lg',
  'border border-border',
  'transition-colors duration-150',
  'focus-within:border-accent focus-within:ring-1 focus-within:ring-accent'
);

const inputBaseStyles = clsx(
  'flex-1 w-full bg-transparent',
  'text-text-primary placeholder:text-text-tertiary',
  'focus:outline-none',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

const sizeStyles = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-14 px-4 text-lg',
};

const iconStyles = 'text-text-tertiary shrink-0';

const errorStyles = 'border-error focus-within:border-error focus-within:ring-error';

const hintStyles = 'text-xs text-text-tertiary';

const errorTextStyles = 'text-xs text-error';

// ============================================
// Component
// ============================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, leftIcon, rightIcon, size = 'md', className, id: providedId, ...props },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    return (
      <div className={containerStyles}>
        {label && (
          <label htmlFor={id} className={labelStyles}>
            {label}
          </label>
        )}

        <div className={clsx(inputWrapperStyles, error && errorStyles)}>
          {leftIcon && <span className={clsx(iconStyles, 'pl-3')}>{leftIcon}</span>}

          <input
            ref={ref}
            id={id}
            className={clsx(
              inputBaseStyles,
              sizeStyles[size],
              leftIcon && 'pl-2',
              rightIcon && 'pr-2',
              className
            )}
            {...props}
          />

          {rightIcon && <span className={clsx(iconStyles, 'pr-3')}>{rightIcon}</span>}
        </div>

        {error && <p className={errorTextStyles}>{error}</p>}
        {hint && !error && <p className={hintStyles}>{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================
// TextArea Variant
// ============================================

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className, id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    return (
      <div className={containerStyles}>
        {label && (
          <label htmlFor={id} className={labelStyles}>
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={id}
          className={clsx(
            'w-full bg-bg-elevated rounded-lg',
            'border border-border',
            'px-4 py-3 text-base',
            'text-text-primary placeholder:text-text-tertiary',
            'transition-colors duration-150',
            'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'resize-none',
            error && errorStyles,
            className
          )}
          {...props}
        />

        {error && <p className={errorTextStyles}>{error}</p>}
        {hint && !error && <p className={hintStyles}>{hint}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
