/**
 * Button Component
 *
 * A versatile button component with multiple variants and states.
 * Supports Romanian diacritics (ă, â, î, ș, ț) in button text.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Salvează
 * </Button>
 *
 * <Button variant="secondary" loading>
 *   Se încarcă...
 * </Button>
 *
 * <Button variant="ghost" disabled>
 *   Anulează
 * </Button>
 * ```
 */

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { ButtonProps } from '@legal-platform/types';

const buttonVariants = cva(
  // Base styles - applies to all buttons
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary-500',
        secondary:
          'bg-secondary-600 text-white hover:bg-secondary-700 active:bg-secondary-800 focus-visible:ring-secondary-500',
        ghost:
          'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-500',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

/**
 * Button component with support for multiple variants and loading state
 *
 * @param variant - Visual style of the button (primary, secondary, ghost)
 * @param size - Size of the button (sm, md, lg)
 * @param loading - Shows loading spinner and disables interaction
 * @param disabled - Disables the button
 * @param children - Button content (supports Romanian diacritics: ă, â, î, ș, ț)
 * @param className - Additional CSS classes
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        className={clsx(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
