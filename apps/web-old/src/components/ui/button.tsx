'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ============================================================================
// Spinner Component (internal)
// ============================================================================

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// Button Component
// ============================================================================

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-linear-accent text-white shadow-sm hover:bg-linear-accent-hover active:bg-linear-accent',
        primary:
          'bg-linear-accent text-white shadow-sm hover:bg-linear-accent-hover active:bg-linear-accent',
        secondary:
          'bg-linear-bg-tertiary text-linear-text-primary border border-linear-border shadow-sm hover:bg-linear-bg-hover hover:border-linear-border-strong',
        ghost: 'text-linear-text-primary hover:bg-linear-bg-hover',
        danger:
          'bg-linear-error text-white shadow-sm hover:bg-linear-error/90 active:bg-linear-error',
        destructive:
          'bg-linear-error text-white shadow-sm hover:bg-linear-error/90 active:bg-linear-error',
        outline:
          'border border-linear-border bg-transparent text-linear-text-primary hover:bg-linear-bg-hover',
        link: 'text-linear-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-3 py-2 text-xs',
        md: 'h-10 px-4 py-2.5',
        lg: 'h-11 px-6 py-2.5',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const Comp = asChild ? Slot : 'button';

    // For icon-only buttons, don't render left/right icons
    const isIconOnly = size === 'icon';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {!loading && !isIconOnly && leftIcon}
        {children}
        {!isIconOnly && rightIcon}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

// ============================================================================
// IconButton Component - 36x36px icon-only button
// ============================================================================

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-lg transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-transparent text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        ghost:
          'bg-transparent text-linear-text-secondary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        subtle:
          'bg-transparent text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-secondary',
      },
      size: {
        default: 'h-9 w-9',
        sm: 'h-7 w-7',
        lg: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

// ============================================================================
// ActionButton Component - Small inline action button (4px 8px, 11px font)
// ============================================================================

const actionButtonVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-linear-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-linear-bg-tertiary text-linear-text-tertiary border border-linear-border-subtle hover:bg-linear-bg-hover hover:text-linear-text-primary hover:border-linear-border',
        ghost:
          'bg-transparent text-linear-text-tertiary hover:bg-linear-bg-hover hover:text-linear-text-primary',
        accent:
          'bg-linear-accent/10 text-linear-accent border border-linear-accent/20 hover:bg-linear-accent/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionButtonVariants> {}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <button
        className={cn(actionButtonVariants({ variant }), 'px-2 py-1', className)}
        ref={ref}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  }
);
ActionButton.displayName = 'ActionButton';

// ============================================================================
// Exports
// ============================================================================

export {
  Button,
  buttonVariants,
  IconButton,
  iconButtonVariants,
  ActionButton,
  actionButtonVariants,
};
