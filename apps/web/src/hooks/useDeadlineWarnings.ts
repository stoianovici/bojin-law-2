/**
 * Deadline Warning React Hooks
 * Story 5.4: Proactive AI Suggestions System (Task 27)
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import type { DeadlineInfo } from '@legal-platform/types';

// ====================
// GraphQL Fragments
// ====================

const DEADLINE_INFO_FRAGMENT = gql`
  fragment DeadlineWarningFields on DeadlineInfo {
    id
    taskId
    title
    dueDate
    daysUntilDue
    severity
    caseId
    case {
      id
      title
    }
    suggestedActions {
      action
      description
      actionType
      payload
    }
    blockedBy
  }
`;

// ====================
// Queries
// ====================

const GET_DEADLINE_WARNINGS = gql`
  ${DEADLINE_INFO_FRAGMENT}
  query GetDeadlineWarnings($input: DeadlineWarningsInput) {
    deadlineWarnings(input: $input) {
      ...DeadlineWarningFields
    }
  }
`;

const GET_OVERDUE_DEADLINES = gql`
  ${DEADLINE_INFO_FRAGMENT}
  query GetOverdueDeadlines {
    overdueDeadlines {
      ...DeadlineWarningFields
    }
  }
`;

const GET_DEADLINE_STATS = gql`
  query GetDeadlineStats {
    deadlineStats {
      total
      critical
      warning
      info
      overdue
    }
  }
`;

// ====================
// Types
// ====================

export interface DeadlineWarningsInput {
  caseId?: string;
  lookaheadDays?: number;
  includeDependencies?: boolean;
}

export interface DeadlineStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  overdue: number;
}

// ====================
// Hooks
// ====================

/**
 * Hook to get deadline warnings
 * Polls every 5 minutes for updates
 */
export function useDeadlineWarnings(input?: DeadlineWarningsInput) {
  const { data, loading, error, refetch } = useQuery<{
    deadlineWarnings: DeadlineInfo[];
  }>(GET_DEADLINE_WARNINGS, {
    variables: { input },
    fetchPolicy: 'cache-and-network',
    pollInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Sort by severity and due date
  const sortedWarnings = useMemo(() => {
    if (!data?.deadlineWarnings) return [];

    return [...data.deadlineWarnings].sort((a, b) => {
      // Severity order: critical > warning > info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff =
        (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);

      if (severityDiff !== 0) return severityDiff;

      // Then by due date (sooner first)
      return a.daysUntilDue - b.daysUntilDue;
    });
  }, [data?.deadlineWarnings]);

  // Filter by severity
  const criticalWarnings = useMemo(
    () => sortedWarnings.filter((d) => d.severity === 'critical'),
    [sortedWarnings]
  );

  const warningWarnings = useMemo(
    () => sortedWarnings.filter((d) => d.severity === 'warning'),
    [sortedWarnings]
  );

  const infoWarnings = useMemo(
    () => sortedWarnings.filter((d) => d.severity === 'info'),
    [sortedWarnings]
  );

  return {
    warnings: sortedWarnings,
    criticalWarnings,
    warningWarnings,
    infoWarnings,
    loading,
    error,
    refetch,
    count: sortedWarnings.length,
    hasCritical: criticalWarnings.length > 0,
    hasWarnings: warningWarnings.length > 0,
  };
}

/**
 * Hook to get deadline warnings for a specific case
 */
export function useCaseDeadlineWarnings(caseId: string) {
  return useDeadlineWarnings({
    caseId,
    includeDependencies: true,
  });
}

/**
 * Hook to get overdue deadlines
 */
export function useOverdueDeadlines() {
  const { data, loading, error, refetch } = useQuery<{
    overdueDeadlines: DeadlineInfo[];
  }>(GET_OVERDUE_DEADLINES, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 5 * 60 * 1000, // 5 minutes
  });

  return {
    overdueDeadlines: data?.overdueDeadlines ?? [],
    loading,
    error,
    refetch,
    count: data?.overdueDeadlines?.length ?? 0,
    hasOverdue: (data?.overdueDeadlines?.length ?? 0) > 0,
  };
}

/**
 * Hook to get deadline statistics
 */
export function useDeadlineStats() {
  const { data, loading, error, refetch } = useQuery<{
    deadlineStats: DeadlineStats;
  }>(GET_DEADLINE_STATS, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 5 * 60 * 1000, // 5 minutes
  });

  return {
    stats: data?.deadlineStats ?? {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      overdue: 0,
    },
    loading,
    error,
    refetch,
  };
}

/**
 * Combined hook for full deadline warning experience
 */
export function useDeadlines(caseId?: string) {
  const warnings = useDeadlineWarnings(caseId ? { caseId } : undefined);
  const overdue = useOverdueDeadlines();
  const stats = useDeadlineStats();

  // Combine all deadlines, removing duplicates
  const allDeadlines = useMemo(() => {
    const seen = new Set<string>();
    const combined: DeadlineInfo[] = [];

    [...(overdue.overdueDeadlines ?? []), ...(warnings.warnings ?? [])].forEach((d) => {
      const id = d.id || d.taskId || d.title;
      if (id && !seen.has(id)) {
        seen.add(id);
        combined.push(d);
      }
    });

    return combined;
  }, [overdue.overdueDeadlines, warnings.warnings]);

  return {
    // All deadlines
    allDeadlines,
    upcomingWarnings: warnings.warnings,
    overdueDeadlines: overdue.overdueDeadlines,

    // By severity
    criticalWarnings: warnings.criticalWarnings,
    warningWarnings: warnings.warningWarnings,
    infoWarnings: warnings.infoWarnings,

    // Stats
    stats: stats.stats,

    // Loading/error states
    loading: warnings.loading || overdue.loading || stats.loading,
    error: warnings.error || overdue.error || stats.error,

    // Refetch functions
    refetchWarnings: warnings.refetch,
    refetchOverdue: overdue.refetch,
    refetchStats: stats.refetch,
    refetchAll: () => {
      warnings.refetch();
      overdue.refetch();
      stats.refetch();
    },

    // Convenience flags
    hasCritical: warnings.hasCritical,
    hasOverdue: overdue.hasOverdue,
    totalCount: allDeadlines.length,
  };
}
