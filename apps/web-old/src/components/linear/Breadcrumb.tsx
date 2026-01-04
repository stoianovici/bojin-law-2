'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ====================================================================
// Breadcrumb - Navigation path for nested pages
// ====================================================================

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Link href (undefined for current/last item) */
  href?: string;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Custom separator (default: ›) */
  separator?: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Breadcrumb renders a navigation path:
 * - Linked items for navigation
 * - Current item displayed as non-link
 * - Separator between items
 *
 * @example
 * <Breadcrumb
 *   items={[
 *     { label: 'Cazuri', href: '/cases' },
 *     { label: 'Ionescu vs. Alpha SRL', href: '/cases/123' },
 *     { label: 'Documente' },
 *   ]}
 * />
 */
export function Breadcrumb({
  className,
  items,
  separator = '›',
  size = 'md',
  ...props
}: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex items-center gap-2',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-[13px]',
        className
      )}
      {...props}
    >
      <ol className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-linear-text-tertiary transition-colors hover:text-linear-text-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? 'font-medium text-linear-text-primary' : 'text-linear-text-tertiary'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="text-linear-text-muted" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ====================================================================
// BreadcrumbLink - Individual breadcrumb link item
// ====================================================================

export interface BreadcrumbLinkProps {
  /** Link destination */
  href: string;
  /** Link content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * BreadcrumbLink for custom breadcrumb composition.
 */
export function BreadcrumbLink({ href, children, className }: BreadcrumbLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'text-linear-text-tertiary transition-colors hover:text-linear-text-primary',
        className
      )}
    >
      {children}
    </Link>
  );
}

// ====================================================================
// BreadcrumbSeparator - Separator between breadcrumb items
// ====================================================================

export interface BreadcrumbSeparatorProps {
  /** Custom separator content */
  children?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * BreadcrumbSeparator for custom breadcrumb composition.
 */
export function BreadcrumbSeparator({ children = '›', className }: BreadcrumbSeparatorProps) {
  return (
    <span className={cn('text-linear-text-muted', className)} aria-hidden="true">
      {children}
    </span>
  );
}

// ====================================================================
// BreadcrumbCurrent - Current page indicator (non-link)
// ====================================================================

export interface BreadcrumbCurrentProps {
  /** Current page label */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * BreadcrumbCurrent for marking the current page in breadcrumb.
 */
export function BreadcrumbCurrent({ children, className }: BreadcrumbCurrentProps) {
  return (
    <span className={cn('font-medium text-linear-text-primary', className)} aria-current="page">
      {children}
    </span>
  );
}

// ====================================================================
// BreadcrumbList - Container for breadcrumb items
// ====================================================================

export interface BreadcrumbListProps extends React.HTMLAttributes<HTMLOListElement> {
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * BreadcrumbList container for composing breadcrumb items manually.
 *
 * @example
 * <nav aria-label="Breadcrumb">
 *   <BreadcrumbList>
 *     <li className="flex items-center gap-2">
 *       <BreadcrumbLink href="/cases">Cazuri</BreadcrumbLink>
 *       <BreadcrumbSeparator />
 *     </li>
 *     <li>
 *       <BreadcrumbCurrent>Documente</BreadcrumbCurrent>
 *     </li>
 *   </BreadcrumbList>
 * </nav>
 */
export function BreadcrumbList({
  className,
  children,
  size = 'md',
  ...props
}: BreadcrumbListProps) {
  return (
    <ol
      className={cn(
        'flex items-center gap-2',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-[13px]',
        className
      )}
      {...props}
    >
      {children}
    </ol>
  );
}
