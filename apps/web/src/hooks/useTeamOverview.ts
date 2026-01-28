'use client';

/**
 * Team Overview Hook
 * Fetches case progress data for the Team Activity Overview feature
 *
 * Provides client-grouped view with:
 * - Cases grouped by client for hierarchical display
 * - Task list with stuck detection
 * - Time-based progress (hours, not task count)
 * - Attention flags for items needing action
 */

import { useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

export type OverviewPeriod = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH';

export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

export interface TimeProgress {
  completedHours: number;
  inProgressHours: number;
  notStartedHours: number;
  totalHours: number;
}

export interface DocStats {
  total: number;
  drafts: number;
  final: number;
  pendingReview: number;
}

export interface AssignedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type AttentionType =
  | 'STUCK_TASK'
  | 'OVERDUE_TASK'
  | 'DRAFT_PENDING_REVIEW'
  | 'COURT_DATE_APPROACHING'
  | 'HEAVY_TASK_APPROACHING'
  | 'OVERBOOKING';
export type AttentionSeverity = 'WARNING' | 'CRITICAL';

export interface AttentionFlag {
  type: AttentionType;
  message: string;
  severity: AttentionSeverity;
  relatedId?: string;
}

export type TaskStatusType = 'Completed' | 'InProgress' | 'ToDo' | 'Blocked' | 'Cancelled';

export interface OverviewTask {
  id: string;
  title: string;
  status: TaskStatusType;
  estimatedHours: number | null;
  assignee: AssignedUser | null;
  isStuck: boolean;
  stuckMessage: string | null;
}

export interface CaseProgress {
  case: {
    id: string;
    caseNumber: string;
    title: string;
    client: {
      id: string;
      name: string;
    } | null;
  };
  taskStats: TaskStats;
  timeProgress: TimeProgress;
  docStats: DocStats;
  assignedUsers: AssignedUser[];
  lastActivity: string | null;
  attentionFlags: AttentionFlag[];
  tasks: OverviewTask[];
}

export interface ClientGroup {
  client: {
    id: string;
    name: string;
  };
  cases: CaseProgress[];
  totalHours: number;
  attentionCount: number;
}

export interface TeamOverviewResult {
  clientGroups: ClientGroup[];
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_CASE_PROGRESS = gql`
  query GetCaseProgress {
    caseProgress {
      cases {
        case {
          id
          caseNumber
          title
          client {
            id
            name
          }
        }
        taskStats {
          total
          completed
          inProgress
          notStarted
          overdue
        }
        timeProgress {
          completedHours
          inProgressHours
          notStartedHours
          totalHours
        }
        docStats {
          total
          drafts
          final
          pendingReview
        }
        assignedUsers {
          id
          firstName
          lastName
          email
        }
        lastActivity
        attentionFlags {
          type
          message
          severity
          relatedId
        }
        tasks {
          id
          title
          status
          estimatedHours
          assignee {
            id
            firstName
            lastName
            email
          }
          isStuck
          stuckMessage
        }
      }
    }
  }
`;

interface GetCaseProgressResult {
  caseProgress: {
    cases: CaseProgress[];
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamOverview(): TeamOverviewResult {
  const { data, loading, error, refetch } = useQuery<GetCaseProgressResult>(GET_CASE_PROGRESS, {
    fetchPolicy: 'cache-and-network',
  });

  // Group cases by client
  const clientGroups = useMemo(() => {
    const cases = data?.caseProgress?.cases || [];

    // Group by client ID
    const groupMap = new Map<string, ClientGroup>();

    for (const caseProgress of cases) {
      const clientId = caseProgress.case.client?.id || 'no-client';
      const clientName = caseProgress.case.client?.name || 'Fără client';

      if (!groupMap.has(clientId)) {
        groupMap.set(clientId, {
          client: { id: clientId, name: clientName },
          cases: [],
          totalHours: 0,
          attentionCount: 0,
        });
      }

      const group = groupMap.get(clientId)!;
      group.cases.push(caseProgress);
      group.totalHours += caseProgress.timeProgress.totalHours;
      group.attentionCount += caseProgress.attentionFlags.length;
    }

    // Convert to array and sort by attention count (most first), then by total hours
    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.attentionCount !== b.attentionCount) {
        return b.attentionCount - a.attentionCount;
      }
      return b.totalHours - a.totalHours;
    });
  }, [data]);

  return {
    clientGroups,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
