/**
 * Capacity Planning React Hooks
 * Story 4.5: Team Workload Management
 *
 * AC: 6 - Capacity planning shows future bottlenecks based on deadlines
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { CapacityForecast } from '@legal-platform/types';

// GraphQL Operations
const GET_CAPACITY_FORECAST = gql`
  query GetCapacityForecast($days: Int) {
    capacityForecast(days: $days) {
      firmId
      forecastRange {
        start
        end
      }
      bottlenecks {
        date
        userId
        user {
          id
          firstName
          lastName
        }
        overageHours
        impactedTasks {
          id
          title
          dueDate
          estimatedHours
          isCriticalPath
          caseId
        }
        severity
        suggestedAction
      }
      teamCapacityByDay {
        date
        totalCapacity
        totalAllocated
      }
      overallRisk
      recommendations
    }
  }
`;

const GET_RESOURCE_ALLOCATION_SUGGESTIONS = gql`
  query GetResourceAllocationSuggestions {
    resourceAllocationSuggestions {
      overloadedUserId
      suggestedDelegateId
      taskId
      rationale
      impactScore
    }
  }
`;

interface ResourceAllocationSuggestion {
  overloadedUserId: string;
  suggestedDelegateId: string;
  taskId: string;
  rationale: string;
  impactScore: number;
}

/**
 * Hook to get capacity forecast
 * @param days - Number of days to forecast (default: 30)
 */
export function useCapacityForecast(days?: number) {
  return useQuery<{ capacityForecast: CapacityForecast }>(GET_CAPACITY_FORECAST, {
    variables: { days },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to get resource allocation suggestions
 */
export function useResourceAllocationSuggestions() {
  return useQuery<{ resourceAllocationSuggestions: ResourceAllocationSuggestion[] }>(
    GET_RESOURCE_ALLOCATION_SUGGESTIONS,
    {
      fetchPolicy: 'cache-and-network',
    }
  );
}
