/**
 * DashboardGrid Component
 * CSS Grid-based dashboard with content-aware widget sizing
 */

'use client';

import React, { type ReactNode } from 'react';
import type { WidgetPosition } from '@legal-platform/types';
import './DashboardGrid.css';

interface DashboardGridProps {
  layout: WidgetPosition[];
  onLayoutChange?: (layout: WidgetPosition[]) => void;
  children: ReactNode;
  isEditing?: boolean;
}

/**
 * Calculate grid-column span based on width value from 12-column layout
 * Maps 12-column grid (w) to 6-column CSS Grid at large screens
 *
 * @param w - Width in 12-column grid (1-12)
 * @returns CSS grid-column value
 */
function calculateGridColumn(w: number): string {
  // Map 12-column layout to 6-column CSS Grid
  // w=12 → span 6 (full width, 100%)
  // w=8 → span 4 (2/3 width, 66.67%)
  // w=6 → span 3 (1/2 width, 50%)
  // w=4 → span 2 (1/3 width, 33.33%)

  // Calculate proportional span: w * 6/12 = w/2
  const span = Math.round(w / 2);

  if (span >= 6) {
    return '1 / -1'; // Full width
  }
  return `span ${span}`;
}

/**
 * DashboardGrid - Content-aware dashboard grid layout
 *
 * Uses CSS Grid with auto-rows for dynamic, content-driven widget heights.
 * Reads layout data and applies appropriate grid-column spans automatically.
 *
 * @param layout - Array of widget positions (defines column placement and spans)
 * @param onLayoutChange - Callback when layout changes (optional, for future drag-and-drop)
 * @param children - Widget components to render
 * @param isEditing - Reserved for future drag-and-drop functionality
 */
export function DashboardGrid({
  layout,
  onLayoutChange: _onLayoutChange,
  children,
  isEditing = false,
}: DashboardGridProps) {
  // Map layout positions by widget key for quick lookup
  const layoutMap = new Map(layout.map(pos => [pos.i, pos]));

  // Apply grid-column styles based on layout data
  const childrenWithStyles = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const key = child.key?.toString();
    if (!key) return child;

    // Find layout data for this widget
    const layoutData = layoutMap.get(key);
    if (!layoutData) return child;

    // Calculate grid-column span
    const gridColumn = calculateGridColumn(layoutData.w);

    // Clone child with grid-column style
    return React.cloneElement(child, {
      style: {
        ...((child.props as Record<string, unknown>).style || {}),
        gridColumn,
      },
    });
  });

  return (
    <div className="dashboard-grid-container" data-editing={isEditing}>
      {childrenWithStyles}
    </div>
  );
}
