/**
 * BaseWidget Component
 * Story 2.11.4: Financial Dashboard UI
 *
 * Reusable wrapper component for analytics widgets.
 * Handles loading, error, and empty states.
 */

'use client';

import React, { type ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { WidgetSkeleton } from './WidgetSkeleton';

/**
 * Props for BaseWidget component
 */
export interface BaseWidgetProps {
  /**
   * Widget title displayed in header
   */
  title: string;

  /**
   * Whether data is loading
   */
  isLoading?: boolean;

  /**
   * Error object if fetch failed
   */
  error?: Error | null;

  /**
   * Retry callback for error state
   */
  onRetry?: () => void;

  /**
   * Widget content
   */
  children: ReactNode;

  /**
   * Optional header actions (e.g., refresh button)
   */
  actions?: ReactNode;

  /**
   * Optional additional class names
   */
  className?: string;

  /**
   * Empty state message
   */
  emptyMessage?: string;

  /**
   * Whether to show empty state
   */
  isEmpty?: boolean;

  /**
   * Custom skeleton component
   */
  skeleton?: ReactNode;
}

/**
 * BaseWidget - Wrapper component for analytics widgets
 *
 * @example
 * ```tsx
 * <BaseWidget
 *   title="Revenue Overview"
 *   isLoading={loading}
 *   error={error}
 *   onRetry={refetch}
 * >
 *   <RevenueChart data={data} />
 * </BaseWidget>
 * ```
 */
export function BaseWidget({
  title,
  isLoading = false,
  error = null,
  onRetry,
  children,
  actions,
  className = '',
  emptyMessage = 'Nu există date disponibile',
  isEmpty = false,
  skeleton,
}: BaseWidgetProps) {
  return (
    <div className={`bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-4 transition-all duration-200 hover:border-linear-border hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-linear-text-primary">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-4" data-testid="widget-loading">
          {skeleton || <WidgetSkeleton />}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          className="flex flex-col items-center justify-center py-8 text-center"
          data-testid="widget-error"
        >
          <AlertCircle className="w-10 h-10 text-linear-error mb-3" />
          <p className="text-linear-error font-medium mb-2">Eroare la încărcarea datelor</p>
          <p className="text-linear-text-tertiary text-sm mb-4">
            {error.message || 'A apărut o eroare neașteptată'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-linear-accent bg-linear-accent/10 rounded-lg hover:bg-linear-accent/15 focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reîncearcă
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && isEmpty && (
        <div
          className="flex flex-col items-center justify-center py-8 text-center"
          data-testid="widget-empty"
        >
          <p className="text-linear-text-tertiary">{emptyMessage}</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && !isEmpty && children}
    </div>
  );
}

export default BaseWidget;
