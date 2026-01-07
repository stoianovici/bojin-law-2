'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ====================================================================
// TasksLayout - 2-column layout with fixed detail panel
// ====================================================================

export interface TasksLayoutProps {
  /** The task list area (left side) */
  children: React.ReactNode;
  /** The detail panel content (right side) */
  detailPanel?: React.ReactNode;
  /** Whether the detail panel is visible */
  showDetailPanel?: boolean;
  /** Width of the detail panel */
  detailPanelWidth?: number;
  /** Additional className */
  className?: string;
}

/**
 * TasksLayout provides a 2-column layout:
 * - Left: scrollable task list
 * - Right: fixed detail panel (360px default)
 */
export function TasksLayout({
  children,
  detailPanel,
  showDetailPanel = false,
  detailPanelWidth = 360,
  className,
}: TasksLayoutProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Task List Area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          marginRight: showDetailPanel ? `${detailPanelWidth}px` : 0,
        }}
      >
        {children}
      </div>

      {/* Detail Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full border-l border-linear-border-subtle bg-linear-bg-secondary transition-transform duration-200 ease-in-out',
          showDetailPanel ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width: `${detailPanelWidth}px` }}
      >
        {detailPanel}
      </div>
    </div>
  );
}
