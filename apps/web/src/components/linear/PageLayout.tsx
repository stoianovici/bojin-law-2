'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// PageLayout - Standard page wrapper with Linear styling
// ====================================================================

export interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional glow effect at the top (for dashboard pages) */
  withGlow?: boolean;
}

/**
 * PageLayout provides the standard Linear-style page wrapper with:
 * - Primary background color
 * - Optional radial gradient glow at top
 * - Consistent padding
 */
export function PageLayout({ className, children, withGlow = false, ...props }: PageLayoutProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-linear-bg-primary p-6',
        withGlow && 'bg-gradient-to-b from-linear-accent/5 via-transparent to-transparent',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ====================================================================
// PageHeader - Sticky header bar with blur backdrop
// ====================================================================

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Page title */
  title: string;
  /** Optional right-side content (actions, search, etc.) */
  actions?: React.ReactNode;
}

/**
 * PageHeader provides the sticky header with:
 * - Blur backdrop effect
 * - Page title on the left
 * - Optional actions on the right
 */
export function PageHeader({ className, title, actions, ...props }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex items-center justify-between',
        'border-b border-linear-border-subtle bg-linear-bg-primary/80 backdrop-blur-xl',
        'px-6 py-4',
        className
      )}
      {...props}
    >
      <h1 className="text-base font-semibold text-linear-text-primary">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}

// ====================================================================
// PageContent - Main content area with max-width constraint
// ====================================================================

export interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove max-width constraint for full-width layouts */
  fullWidth?: boolean;
}

/**
 * PageContent wraps main content with optional max-width constraint.
 */
export function PageContent({ className, children, fullWidth = false, ...props }: PageContentProps) {
  return (
    <div className={cn(!fullWidth && 'mx-auto max-w-7xl', className)} {...props}>
      {children}
    </div>
  );
}
