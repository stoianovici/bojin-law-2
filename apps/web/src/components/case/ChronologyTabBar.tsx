/**
 * ChronologyTabBar Component
 * OPS-053: Chronology Tab Bar & Event Filtering
 *
 * Tab bar for switching between chronology event categories
 */

'use client';

import React from 'react';
import { clsx } from 'clsx';
import { TAB_CONFIG, TAB_ORDER, type ChronologyTab } from './chronologyTabs';

// ============================================================================
// Types
// ============================================================================

export interface ChronologyTabBarProps {
  activeTab: ChronologyTab;
  counts: Record<ChronologyTab, number>;
  onTabChange: (tab: ChronologyTab) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Tab bar for filtering chronology events by category
 * @param activeTab - Currently selected tab
 * @param counts - Event counts per tab category
 * @param onTabChange - Callback when tab is selected
 */
export function ChronologyTabBar({
  activeTab,
  counts,
  onTabChange,
  className,
}: ChronologyTabBarProps) {
  return (
    <div className={clsx('flex border-b border-gray-200', className)}>
      {TAB_ORDER.map((tab) => {
        const config = TAB_CONFIG[tab];
        const isActive = tab === activeTab;
        const count = counts[tab];

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors relative',
              isActive
                ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            {config.label}
            {tab !== 'all' && count > 0 && (
              <span
                className={clsx(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

ChronologyTabBar.displayName = 'ChronologyTabBar';
