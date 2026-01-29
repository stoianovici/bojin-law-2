import { useMemo } from 'react';
import { DatabaseRole, isAssignmentBasedRole } from '@/store/authStore';

// ============================================================================
// Types
// ============================================================================

export interface QuickAction {
  id: string;
  label: string;
  href?: string;
  shortcut: string;
  icon: 'plus' | 'task' | 'clock' | 'ai';
}

export interface DashboardConfig {
  // Stats row (4th stat)
  showTeamUtilization: boolean;
  showOverdueCount: boolean;

  // Column 3 widget
  showFirmMetrics: boolean;
  showDeadlineCalendar: boolean;

  // Bottom left widget
  showTeamUtilizationChart: boolean;
  showRecentDocuments: boolean;

  // Cases widget filter
  casesAssignedToMeOnly: boolean;

  // Quick actions
  quickActions: QuickAction[];
}

// ============================================================================
// Quick Actions
// ============================================================================

const allQuickActions: QuickAction[] = [
  { id: 'case', label: 'Caz nou', href: '/cases/new', shortcut: '\u2318N', icon: 'plus' },
  {
    id: 'task',
    label: 'Sarcin\u0103 nou\u0103',
    href: '/tasks/new',
    shortcut: '\u2318T',
    icon: 'task',
  },
  {
    id: 'time',
    label: '\u00CEnregistrare timp',
    href: '/time/new',
    shortcut: '\u2318L',
    icon: 'clock',
  },
  { id: 'ai', label: '\u00CEntreab\u0103 AI', shortcut: '\u2318J', icon: 'ai' },
];

const assignmentBasedQuickActions: QuickAction[] = [
  {
    id: 'task',
    label: 'Sarcin\u0103 nou\u0103',
    href: '/tasks/new',
    shortcut: '\u2318T',
    icon: 'task',
  },
  { id: 'ai', label: '\u00CEntreab\u0103 AI', shortcut: '\u2318J', icon: 'ai' },
];

// ============================================================================
// Hook
// ============================================================================

export function useDashboardConfig(dbRole?: DatabaseRole | string): DashboardConfig {
  return useMemo(() => {
    const isAssignmentBased = isAssignmentBasedRole(dbRole);

    if (isAssignmentBased) {
      // Junior Associates and Paralegals see personal productivity dashboard
      return {
        showTeamUtilization: false,
        showOverdueCount: true,
        showFirmMetrics: false,
        showDeadlineCalendar: true,
        showTeamUtilizationChart: false,
        showRecentDocuments: true,
        casesAssignedToMeOnly: true,
        quickActions: assignmentBasedQuickActions,
      };
    }

    // Partners and Associates see firm-wide metrics dashboard
    return {
      showTeamUtilization: true,
      showOverdueCount: false,
      showFirmMetrics: true,
      showDeadlineCalendar: false,
      showTeamUtilizationChart: true,
      showRecentDocuments: false,
      casesAssignedToMeOnly: false,
      quickActions: allQuickActions,
    };
  }, [dbRole]);
}
