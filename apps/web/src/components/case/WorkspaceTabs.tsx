/**
 * WorkspaceTabs - Tab navigation for case workspace
 * Provides tab switching between Overview, Documents, Tasks, Communications, Time Entries, and Notes
 */

'use client';

import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import type { WorkspaceTab } from '@legal-platform/types';
import { useCaseWorkspaceStore } from '../../stores/case-workspace.store';

export interface WorkspaceTabsProps {
  children?: React.ReactNode;
  className?: string;
}

interface TabConfig {
  value: WorkspaceTab;
  label: string;
  icon: React.ReactNode;
}

const tabConfigs: TabConfig[] = [
  {
    value: 'overview',
    label: 'Prezentare Generală',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
        />
      </svg>
    ),
  },
  {
    value: 'documents',
    label: 'Documente',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    value: 'tasks',
    label: 'Sarcini',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    ),
  },
  {
    value: 'communications',
    label: 'Comunicări',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    value: 'time-entries',
    label: 'Înregistrări Timp',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    value: 'notes',
    label: 'Notițe',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      </svg>
    ),
  },
  {
    value: 'intelligence',
    label: 'Inteligență AI',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
  },
];

/**
 * WorkspaceTabs Component
 *
 * Tab navigation component for case workspace.
 * Integrates with Zustand store for state management and provides
 * keyboard navigation support.
 */
export function WorkspaceTabs({ children, className }: WorkspaceTabsProps) {
  const activeTab = useCaseWorkspaceStore((state) => state.activeTab);
  const setActiveTab = useCaseWorkspaceStore((state) => state.setActiveTab);

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
      className={clsx('flex flex-col w-full', className)}
    >
      {/* Tab List */}
      <Tabs.List
        className="flex border-b border-gray-200 bg-white px-6 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        aria-label="Workspace tabs"
      >
        {tabConfigs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-all whitespace-nowrap',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white',
              'hover:text-gray-900 hover:bg-gray-50',
              // Inactive state
              'text-gray-600 border-transparent',
              // Active state - using data-state attribute from Radix
              'data-[state=active]:text-blue-600 data-[state=active]:border-blue-600 data-[state=active]:font-semibold'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* Tab Content */}
      {children}
    </Tabs.Root>
  );
}

/**
 * TabContent Component
 *
 * Wrapper for individual tab content panels.
 * Use this to wrap content for each tab.
 */
export function TabContent({
  value,
  children,
  className,
}: {
  value: WorkspaceTab;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tabs.Content
      value={value}
      className={clsx(
        'flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        className
      )}
    >
      {children}
    </Tabs.Content>
  );
}

WorkspaceTabs.displayName = 'WorkspaceTabs';
TabContent.displayName = 'TabContent';
