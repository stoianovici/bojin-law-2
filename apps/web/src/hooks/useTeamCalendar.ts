/**
 * Team Calendar React Hook
 * Story 4.5: Team Workload Management
 *
 * AC: 1 - Team calendar shows all members' tasks and availability
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type {
  TeamCalendarView,
  TeamMemberCalendar,
} from '@legal-platform/types';

// GraphQL Operations
const GET_TEAM_CALENDAR = gql`
  query GetTeamCalendar($dateRange: DateRangeInput!) {
    teamCalendar(dateRange: $dateRange) {
      firmId
      startDate
      endDate
      members {
        userId
        user {
          id
          firstName
          lastName
          role
        }
        entries {
          userId
          date
          tasks {
            id
            title
            type
            dueDate
            dueTime
            status
            estimatedHours
            caseId
            caseTitle
            isCriticalPath
          }
          availability {
            id
            availabilityType
            hoursPerDay
            reason
          }
          totalAllocatedHours
          capacityHours
          utilizationPercent
        }
        weeklyTotal
        weeklyCapacity
        hasAvailabilityOverride
      }
    }
  }
`;

const GET_MY_CALENDAR = gql`
  query GetMyCalendar($dateRange: DateRangeInput!) {
    myCalendar(dateRange: $dateRange) {
      userId
      user {
        id
        firstName
        lastName
        role
      }
      entries {
        userId
        date
        tasks {
          id
          title
          type
          dueDate
          dueTime
          status
          estimatedHours
          caseId
          caseTitle
          isCriticalPath
        }
        availability {
          id
          availabilityType
          hoursPerDay
          reason
        }
        totalAllocatedHours
        capacityHours
        utilizationPercent
      }
      weeklyTotal
      weeklyCapacity
      hasAvailabilityOverride
    }
  }
`;

interface DateRangeInput {
  start: string; // ISO date
  end: string;
}

/**
 * Hook to get team calendar view
 */
export function useTeamCalendar(dateRange: DateRangeInput) {
  return useQuery<{ teamCalendar: TeamCalendarView }>(GET_TEAM_CALENDAR, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to get current user's calendar view
 */
export function useMyCalendar(dateRange: DateRangeInput) {
  return useQuery<{ myCalendar: TeamMemberCalendar }>(GET_MY_CALENDAR, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}
