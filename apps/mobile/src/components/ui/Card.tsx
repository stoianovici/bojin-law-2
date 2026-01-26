'use client';

import { forwardRef, memo } from 'react';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

// ============================================
// Styles
// ============================================

const baseStyles = 'rounded-xl overflow-hidden';

const variantStyles = {
  default: 'bg-bg-card',
  elevated: 'bg-bg-elevated shadow-lg',
  outline: 'bg-transparent border border-border',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const interactiveStyles = clsx(
  'cursor-pointer',
  'transition-opacity duration-150',
  'hover:bg-bg-hover',
  'active:bg-bg-elevated',
  'active:scale-[0.99]'
);

// ============================================
// Component
// ============================================

const CardComponent = forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = 'default', padding = 'md', interactive = false, className, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          paddingStyles[padding],
          interactive && interactiveStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardComponent.displayName = 'Card';

export const Card = memo(CardComponent);

// ============================================
// Card Header
// ============================================

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action, className, ...props }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-3', className)} {...props}>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-text-primary truncate">{title}</h3>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ============================================
// Card Content
// ============================================

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('mt-3', className)} {...props}>
      {children}
    </div>
  );
}

// ============================================
// Card Footer
// ============================================

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('mt-4 pt-3 border-t border-border flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}
