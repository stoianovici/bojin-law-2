/**
 * DashboardGrid Component
 * Wrapper for react-grid-layout with drag-and-drop functionality
 */

'use client';

import React, { type ReactNode } from 'react';
import GridLayout, { type Layout, WidthProvider } from 'react-grid-layout';
import type { WidgetPosition } from '@legal-platform/types';
import 'react-grid-layout/css/styles.css';
import './DashboardGrid.css';

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface DashboardGridProps {
  layout: WidgetPosition[];
  onLayoutChange: (layout: WidgetPosition[]) => void;
  children: ReactNode;
  isEditing?: boolean;
}

// Convert WidgetPosition to react-grid-layout Layout format
const convertToGridLayout = (positions: WidgetPosition[]): Layout[] => {
  return positions.map((pos) => ({
    i: pos.i,
    x: pos.x,
    y: pos.y,
    w: pos.w,
    h: pos.h,
    minW: pos.minW,
    minH: pos.minH,
    maxW: pos.maxW,
    maxH: pos.maxH,
    static: pos.static || false,
  }));
};

// Convert react-grid-layout Layout to WidgetPosition format
const convertFromGridLayout = (layouts: Layout[]): WidgetPosition[] => {
  return layouts.map((layout) => ({
    i: layout.i,
    x: layout.x,
    y: layout.y,
    w: layout.w,
    h: layout.h,
    minW: layout.minW,
    minH: layout.minH,
    maxW: layout.maxW,
    maxH: layout.maxH,
    static: layout.static,
  }));
};

/**
 * DashboardGrid - Drag-and-drop dashboard grid layout
 *
 * @param layout - Array of widget positions
 * @param onLayoutChange - Callback when layout changes
 * @param children - Widget components to render
 * @param isEditing - Whether drag-and-drop is enabled (default: true)
 */
export function DashboardGrid({
  layout,
  onLayoutChange,
  children,
  isEditing = true,
}: DashboardGridProps) {
  const handleLayoutChange = (newLayout: Layout[]) => {
    const convertedLayout = convertFromGridLayout(newLayout);
    onLayoutChange(convertedLayout);
  };

  return (
    <div className="dashboard-grid-container">
      <ResponsiveGridLayout
        className="layout"
        layout={convertToGridLayout(layout)}
        onLayoutChange={handleLayoutChange}
        cols={12}
        rowHeight={100}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType="vertical"
        preventCollision={false}
        margin={[20, 40]}
        containerPadding={[20, 20]}
        // Drag handle selector - only drag from widget header
        draggableHandle=".widget-drag-handle"
      >
        {children}
      </ResponsiveGridLayout>
    </div>
  );
}
