'use client';

/**
 * Client Progress Hook
 * Fetches client-level progress data (tasks/docs not tied to any case)
 *
 * Used when a client is selected in the Team Activity sidebar.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type {
  TaskStats,
  TimeProgress,
  DocStats,
  AssignedUser,
  AttentionFlag,
  OverviewTask,
} from './useTeamOverview';

// ============================================================================
// Types
// ============================================================================

export interface ClientProgress {
  client: {
    id: string;
    name: string;
  };
  taskStats: TaskStats;
  timeProgress: TimeProgress;
  docStats: DocStats;
  assignedUsers: AssignedUser[];
  lastActivity: string | null;
  attentionFlags: AttentionFlag[];
  tasks: OverviewTask[];
}

export interface ClientProgressResult {
  clientProgress: ClientProgress | null;
  loading: boolean;
  error?: Error;
  refetch: () => void;
}

// ============================================================================
// GraphQL Query
// ============================================================================

const GET_CLIENT_PROGRESS = gql`
  query GetClientProgress($clientId: ID!) {
    clientProgress(clientId: $clientId) {
      client {
        id
        name
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
`;

interface GetClientProgressResult {
  clientProgress: ClientProgress | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useClientProgress(clientId: string | null): ClientProgressResult {
  const { data, loading, error, refetch } = useQuery<GetClientProgressResult>(GET_CLIENT_PROGRESS, {
    variables: { clientId },
    skip: !clientId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    clientProgress: data?.clientProgress ?? null,
    loading,
    error: error as Error | undefined,
    refetch,
  };
}
