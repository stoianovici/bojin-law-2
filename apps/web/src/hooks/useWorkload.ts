/**
 * Workload React Hooks
 * Story 4.5: Team Workload Management
 *
 * AC: 2 - Workload meter displays hours allocated per person per day
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type {
  TeamWorkloadSummary,
  UserWorkload,
} from '@legal-platform/types';

// GraphQL Operations
const GET_TEAM_WORKLOAD = gql`
  query GetTeamWorkload($dateRange: DateRangeInput!) {
    teamWorkload(dateRange: $dateRange) {
      firmId
      dateRange {
        start
        end
      }
      members {
        userId
        user {
          id
          firstName
          lastName
          role
        }
        dailyWorkloads {
          date
          allocatedHours
          capacityHours
          utilizationPercent
          taskCount
          overloaded
        }
        weeklyAllocated
        weeklyCapacity
        averageUtilization
        status
      }
      teamAverageUtilization
      overloadedCount
      underUtilizedCount
    }
  }
`;

const GET_USER_WORKLOAD = gql`
  query GetUserWorkload($userId: ID!, $dateRange: DateRangeInput!) {
    userWorkload(userId: $userId, dateRange: $dateRange) {
      userId
      user {
        id
        firstName
        lastName
        role
      }
      dailyWorkloads {
        date
        allocatedHours
        capacityHours
        utilizationPercent
        taskCount
        overloaded
      }
      weeklyAllocated
      weeklyCapacity
      averageUtilization
      status
    }
  }
`;

const GET_MY_WORKLOAD = gql`
  query GetMyWorkload($dateRange: DateRangeInput!) {
    myWorkload(dateRange: $dateRange) {
      userId
      user {
        id
        firstName
        lastName
        role
      }
      dailyWorkloads {
        date
        allocatedHours
        capacityHours
        utilizationPercent
        taskCount
        overloaded
      }
      weeklyAllocated
      weeklyCapacity
      averageUtilization
      status
    }
  }
`;

interface DateRangeInput {
  start: string; // ISO date
  end: string;
}

/**
 * Hook to get team workload summary
 */
export function useTeamWorkload(dateRange: DateRangeInput) {
  return useQuery<{ teamWorkload: TeamWorkloadSummary }>(GET_TEAM_WORKLOAD, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to get a specific user's workload
 */
export function useUserWorkload(userId: string, dateRange: DateRangeInput) {
  return useQuery<{ userWorkload: UserWorkload }>(GET_USER_WORKLOAD, {
    variables: { userId, dateRange },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to get current user's workload
 */
export function useMyWorkload(dateRange: DateRangeInput) {
  return useQuery<{ myWorkload: UserWorkload }>(GET_MY_WORKLOAD, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}
