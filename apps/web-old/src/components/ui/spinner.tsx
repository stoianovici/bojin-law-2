/**
 * Spinner Component
 * Common loading indicator used throughout the application
 * Uses Linear design system tokens for consistent styling
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Optional label to display below spinner */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Use accent color (purple) instead of default */
  accent?: boolean;
  /** Center spinner in container */
  centered?: boolean;
}

const SIZE_CLASSES: Record<SpinnerSize, { spinner: string; stroke: string }> = {
  xs: { spinner: 'h-3 w-3', stroke: '2' },
  sm: { spinner: 'h-4 w-4', stroke: '2' },
  md: { spinner: 'h-6 w-6', stroke: '3' },
  lg: { spinner: 'h-8 w-8', stroke: '3' },
  xl: { spinner: 'h-12 w-12', stroke: '4' },
};

/**
 * Spinner loading indicator
 *
 * @example
 * // Basic usage
 * <Spinner />
 *
 * // With label
 * <Spinner label="Se încarcă..." />
 *
 * // Large centered
 * <Spinner size="lg" centered />
 *
 * // In button
 * <Button disabled><Spinner size="xs" className="mr-2" /> Se procesează...</Button>
 */
export function Spinner({
  size = 'md',
  label,
  className,
  accent = false,
  centered = false,
}: SpinnerProps) {
  const { spinner: sizeClass, stroke: strokeWidth } = SIZE_CLASSES[size];

  const spinnerElement = (
    <svg
      className={cn(
        'animate-spin',
        accent ? 'text-linear-accent' : 'text-linear-text-tertiary',
        sizeClass,
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={label || 'Se încarcă'}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  if (label || centered) {
    return (
      <div className={cn('flex flex-col items-center gap-3', centered && 'justify-center py-12')}>
        {spinnerElement}
        {label && <span className="text-sm text-linear-text-secondary">{label}</span>}
      </div>
    );
  }

  return spinnerElement;
}

// ====================================================================
// Loading Overlay
// ====================================================================

interface LoadingOverlayProps {
  /** Show/hide the overlay */
  loading?: boolean;
  /** Content to overlay */
  children: React.ReactNode;
  /** Custom loading indicator */
  spinner?: React.ReactNode;
  /** Optional loading text */
  label?: string;
  className?: string;
}

/**
 * Overlay that dims content and shows a spinner while loading
 *
 * @example
 * <LoadingOverlay loading={isRefreshing}>
 *   <Table data={data} />
 * </LoadingOverlay>
 */
export function LoadingOverlay({
  loading = false,
  children,
  spinner,
  label,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-linear-bg-primary/50 rounded-inherit z-10">
          {spinner || <Spinner size="lg" label={label} accent />}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Page Loading
// ====================================================================

interface PageLoadingProps {
  label?: string;
}

/**
 * Full page loading state
 */
export function PageLoading({ label = 'Se încarcă...' }: PageLoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner size="xl" label={label} accent centered />
    </div>
  );
}

export default Spinner;
