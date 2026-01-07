'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex w-full rounded-md bg-linear-bg-elevated border text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150',
  {
    variants: {
      variant: {
        default: 'border-linear-border-subtle focus:ring-linear-accent',
        error: 'border-linear-error focus:ring-linear-error',
      },
      size: {
        sm: 'h-7 text-xs px-2.5',
        md: 'h-8 text-sm px-3',
        lg: 'h-10 text-sm px-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  error?: boolean;
  errorMessage?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      leftAddon,
      rightAddon,
      error,
      errorMessage,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const computedVariant = error ? 'error' : variant;

    return (
      <div className="w-full">
        <div className="relative">
          {leftAddon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-linear-text-muted">
              {leftAddon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ variant: computedVariant, size, className }),
              leftAddon && 'pl-9',
              rightAddon && 'pr-9'
            )}
            ref={ref}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-linear-text-muted">
              {rightAddon}
            </div>
          )}
        </div>
        {error && errorMessage && (
          <p className="mt-1.5 text-xs text-linear-error">{errorMessage}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

const textAreaVariants = cva(
  'flex w-full rounded-md bg-linear-bg-elevated border text-linear-text-primary placeholder:text-linear-text-muted focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 px-3 py-2',
  {
    variants: {
      variant: {
        default: 'border-linear-border-subtle focus:ring-linear-accent',
        error: 'border-linear-error focus:ring-linear-error',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      variant: 'default',
      resize: 'vertical',
    },
  }
);

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'resize'>,
    VariantProps<typeof textAreaVariants> {
  error?: boolean;
  errorMessage?: string;
  autoResize?: boolean;
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      className,
      variant,
      resize,
      error,
      errorMessage,
      autoResize = false,
      rows = 3,
      onInput,
      ...props
    },
    ref
  ) => {
    const computedVariant = error ? 'error' : variant;
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref || internalRef) as React.RefObject<HTMLTextAreaElement>;

    const handleAutoResize = React.useCallback(() => {
      if (autoResize && combinedRef.current) {
        combinedRef.current.style.height = 'auto';
        combinedRef.current.style.height = `${combinedRef.current.scrollHeight}px`;
      }
    }, [autoResize, combinedRef]);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      handleAutoResize();
      onInput?.(e);
    };

    React.useEffect(() => {
      handleAutoResize();
    }, [handleAutoResize]);

    return (
      <div className="w-full">
        <textarea
          className={cn(
            textAreaVariants({
              variant: computedVariant,
              resize: autoResize ? 'none' : resize,
              className,
            }),
            'text-sm'
          )}
          ref={combinedRef}
          rows={rows}
          onInput={handleInput}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1.5 text-xs text-linear-error">{errorMessage}</p>
        )}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

export { Input, TextArea, inputVariants, textAreaVariants };
