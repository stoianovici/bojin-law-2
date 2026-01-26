'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ============================================
// Styles
// ============================================

const baseStyles = clsx(
  'inline-flex items-center justify-center',
  'font-medium rounded-lg',
  'transition-colors duration-150',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
  'disabled:opacity-50 disabled:pointer-events-none',
  'active:scale-[0.98]',
  'touch-target' // Ensures minimum 44px touch target
);

const variantStyles: Record<ButtonVariant, string> = {
  primary: clsx('bg-accent text-white', 'hover:bg-accent/90', 'active:bg-accent/80'),
  secondary: clsx(
    'bg-bg-elevated text-text-primary',
    'border border-border',
    'hover:bg-bg-hover',
    'active:bg-bg-card'
  ),
  ghost: clsx(
    'bg-transparent text-text-secondary',
    'hover:bg-bg-hover hover:text-text-primary',
    'active:bg-bg-card'
  ),
  danger: clsx('bg-error text-white', 'hover:bg-error/90', 'active:bg-error/80'),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-base gap-2',
  lg: 'h-14 px-6 text-lg gap-2.5',
};

// ============================================
// Component
// ============================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================
// Loading Spinner
// ============================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[size];

  return (
    <svg className={clsx(spinnerSize, 'animate-spin')} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
