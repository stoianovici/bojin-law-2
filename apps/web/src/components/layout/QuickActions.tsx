/**
 * Quick Actions Component
 * Role-based quick action buttons
 */

'use client';

import React from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../../stores/navigation.store';
import type { QuickAction } from '@legal-platform/types';
import {
  Scale,
  CheckCircle,
  TrendingUp,
  Users,
  FileEdit,
  Clock,
  CheckSquare,
  Search,
  Upload,
  Calendar,
  StickyNote,
  ClipboardList,
  type LucideIcon
} from 'lucide-react';

/**
 * Icon mapping for quick actions
 */
const iconMap: Record<string, LucideIcon> = {
  'new-case': Scale,
  'approve-docs': CheckCircle,
  'reports': TrendingUp,
  'manage-team': Users,
  'new-doc': FileEdit,
  'log-time': Clock,
  'update-task': CheckSquare,
  'case-search': Search,
  'upload-doc': Upload,
  'schedule-court': Calendar,
  'add-note': StickyNote,
  'create-task': ClipboardList,
};

/**
 * Quick actions configuration by role with Lucide React icons
 */
const quickActions: QuickAction[] = [
  // Partner actions
  {
    id: 'partner-new-case',
    label: 'New Case',
    icon: 'new-case',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Partner'],
    shortcut: 'Shift+C',
  },
  {
    id: 'partner-approve-docs',
    label: 'Approve Documents',
    icon: 'approve-docs',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Partner'],
  },
  {
    id: 'partner-reports',
    label: 'View Reports',
    icon: 'reports',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Partner'],
  },
  {
    id: 'partner-manage-team',
    label: 'Manage Team',
    icon: 'manage-team',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Partner'],
  },
  // Associate actions
  {
    id: 'associate-new-doc',
    label: 'New Document',
    icon: 'new-doc',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Associate'],
    shortcut: 'Shift+D',
  },
  {
    id: 'associate-log-time',
    label: 'Log Time',
    icon: 'log-time',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Associate'],
  },
  {
    id: 'associate-update-task',
    label: 'Update Task',
    icon: 'update-task',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Associate'],
  },
  {
    id: 'associate-case-search',
    label: 'Case Search',
    icon: 'case-search',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Associate'],
  },
  // Paralegal actions
  {
    id: 'paralegal-upload-doc',
    label: 'Upload Document',
    icon: 'upload-doc',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Paralegal'],
  },
  {
    id: 'paralegal-schedule-court',
    label: 'Schedule Court Date',
    icon: 'schedule-court',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Paralegal'],
  },
  {
    id: 'paralegal-add-note',
    label: 'Add Note',
    icon: 'add-note',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Paralegal'],
  },
  {
    id: 'paralegal-create-task',
    label: 'Create Task',
    icon: 'create-task',
    action: () => {}, // TODO: Implement action in future story
    roles: ['Paralegal'],
  },
];

export interface QuickActionsProps {
  /**
   * Display mode: 'sidebar' or 'floating'
   */
  mode?: 'sidebar' | 'floating';

  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * Quick Actions component
 * Features:
 * - Role-based action filtering
 * - Keyboard shortcuts (displayed in tooltips)
 * - Responsive display modes
 */
export function QuickActions({ mode = 'sidebar', className = '' }: QuickActionsProps) {
  const { currentRole, isSidebarCollapsed } = useNavigationStore();

  // Filter actions by current role
  const visibleActions = quickActions.filter((action) =>
    action.roles.includes(currentRole)
  );

  // Don't show in collapsed sidebar mode
  if (mode === 'sidebar' && isSidebarCollapsed) {
    return null;
  }

  return (
    <div className={`${className} space-y-2`}>
      {mode === 'sidebar' && (
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Quick Actions
        </div>
      )}
      <div className={`${mode === 'sidebar' ? 'px-4 space-y-2' : 'flex flex-wrap gap-2'}`}>
        {visibleActions.map((action) => {
          const IconComponent = iconMap[action.icon];
          return (
            <button
              key={action.id}
              onClick={action.action}
              className="
                flex items-center justify-center gap-2
                w-full px-3 py-2 rounded-lg
                bg-blue-600 hover:bg-blue-700
                text-white text-sm font-medium
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors
              "
              title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
            >
              {IconComponent && <IconComponent className="w-4 h-4" aria-hidden="true" />}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
