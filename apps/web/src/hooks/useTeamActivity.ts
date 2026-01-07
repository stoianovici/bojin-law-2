/**
 * Team Activity Hook
 * Fetches team activity data for partner oversight and timesheet generation
 *
 * Provides filtered task data based on:
 * - Case selection (optional)
 * - Team member selection (optional)
 * - Date range (required)
 */

import { useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// Types
// ============================================================================

export type ActivityViewMode = 'view' | 'timesheet';

export interface TeamActivityFilters {
  caseId?: string | null;
  teamMemberIds?: string[];
  startDate: Date;
  endDate: Date;
}

export interface ActivityTask {
  id: string;
  title: string;
  description?: string;
  type: string;
  completedAt: string;
  case: {
    id: string;
    title: string;
    caseNumber?: string;
  };
}

export interface ActivityUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ActivityEntry {
  id: string;
  task: ActivityTask;
  user: ActivityUser;
  hoursLogged: number;
  completedAt: string;
}

export interface TeamActivityResult {
  entries: ActivityEntry[];
  totalTasks: number;
  totalHours: number;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_TEAM_ACTIVITY = gql`
  query GetTeamActivity($filters: TeamActivityFilters!) {
    teamActivity(filters: $filters) {
      entries {
        id
        task {
          id
          title
          description
          type
          completedAt
          case {
            id
            title
            caseNumber
          }
        }
        user {
          id
          firstName
          lastName
          email
          role
        }
        hoursLogged
        completedAt
      }
      totalTasks
      totalHours
    }
  }
`;

interface GetTeamActivityResult {
  teamActivity: {
    entries: ActivityEntry[];
    totalTasks: number;
    totalHours: number;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useTeamActivity(filters: TeamActivityFilters): TeamActivityResult {
  const variables = useMemo(
    () => ({
      filters: {
        caseId: filters.caseId || undefined,
        userIds:
          filters.teamMemberIds && filters.teamMemberIds.length > 0
            ? filters.teamMemberIds
            : undefined,
        periodStart: filters.startDate.toISOString(),
        periodEnd: filters.endDate.toISOString(),
      },
    }),
    [filters.caseId, filters.teamMemberIds, filters.startDate, filters.endDate]
  );

  const { data, loading, error, refetch } = useQuery<GetTeamActivityResult>(GET_TEAM_ACTIVITY, {
    variables,
    fetchPolicy: 'cache-and-network',
  });

  const result = useMemo(() => {
    return {
      entries: data?.teamActivity?.entries || [],
      totalTasks: data?.teamActivity?.totalTasks || 0,
      totalHours: data?.teamActivity?.totalHours || 0,
    };
  }, [data]);

  return {
    ...result,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}

// ============================================================================
// Date Range Helpers
// ============================================================================

export function getDefaultDateRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate, endDate };
}

export function getTodayRange(): { startDate: Date; endDate: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  return { startDate: today, endDate: endOfDay };
}

export function getWeekRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + mondayOffset);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}

export function getMonthRange(monthOffset = 0): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
}
