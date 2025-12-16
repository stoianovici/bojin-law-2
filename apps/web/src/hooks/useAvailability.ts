/**
 * Availability React Hooks
 * Story 4.5: Team Workload Management
 *
 * AC: 1, 5 - User availability and OOO management
 */

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import type { UserAvailability, CreateAvailabilityInput } from '@legal-platform/types';

// GraphQL Operations
const AVAILABILITY_FRAGMENT = gql`
  fragment AvailabilityFields on UserAvailability {
    id
    userId
    user {
      id
      firstName
      lastName
      role
    }
    firmId
    availabilityType
    startDate
    endDate
    hoursPerDay
    reason
    autoReassign
    delegateTo
    delegate {
      id
      firstName
      lastName
    }
    createdAt
    updatedAt
  }
`;

const GET_MY_AVAILABILITIES = gql`
  ${AVAILABILITY_FRAGMENT}
  query GetMyAvailabilities($dateRange: DateRangeInput) {
    myAvailabilities(dateRange: $dateRange) {
      ...AvailabilityFields
    }
  }
`;

const GET_TEAM_AVAILABILITY = gql`
  ${AVAILABILITY_FRAGMENT}
  query GetTeamAvailability($dateRange: DateRangeInput!) {
    teamAvailability(dateRange: $dateRange) {
      ...AvailabilityFields
    }
  }
`;

const CREATE_AVAILABILITY = gql`
  ${AVAILABILITY_FRAGMENT}
  mutation CreateAvailability($input: CreateAvailabilityInput!) {
    createAvailability(input: $input) {
      ...AvailabilityFields
    }
  }
`;

const UPDATE_AVAILABILITY = gql`
  ${AVAILABILITY_FRAGMENT}
  mutation UpdateAvailability($id: ID!, $input: UpdateAvailabilityInput!) {
    updateAvailability(id: $id, input: $input) {
      ...AvailabilityFields
    }
  }
`;

const DELETE_AVAILABILITY = gql`
  mutation DeleteAvailability($id: ID!) {
    deleteAvailability(id: $id)
  }
`;

const PROCESS_OOO_REASSIGNMENTS = gql`
  mutation ProcessOOOReassignments($availabilityId: ID!) {
    processOOOReassignments(availabilityId: $availabilityId) {
      userId
      period {
        start
        end
      }
      tasksReassigned {
        taskId
        taskTitle
        originalAssignee
        newAssignee
        reason
        success
        error
      }
      tasksSkipped {
        taskId
        reason
      }
      delegateTo
    }
  }
`;

interface DateRangeInput {
  start: string;
  end: string;
}

/**
 * Hook to get current user's availabilities
 */
export function useMyAvailabilities(dateRange?: DateRangeInput) {
  return useQuery<{ myAvailabilities: UserAvailability[] }>(GET_MY_AVAILABILITIES, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to get team availability
 */
export function useTeamAvailability(dateRange: DateRangeInput) {
  return useQuery<{ teamAvailability: UserAvailability[] }>(GET_TEAM_AVAILABILITY, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });
}

/**
 * Hook to create availability
 */
export function useCreateAvailability() {
  return useMutation<{ createAvailability: UserAvailability }, { input: CreateAvailabilityInput }>(
    CREATE_AVAILABILITY,
    {
      refetchQueries: ['GetMyAvailabilities', 'GetTeamAvailability'],
    }
  );
}

/**
 * Hook to update availability
 */
export function useUpdateAvailability() {
  return useMutation<
    { updateAvailability: UserAvailability },
    { id: string; input: Partial<CreateAvailabilityInput> }
  >(UPDATE_AVAILABILITY, {
    refetchQueries: ['GetMyAvailabilities', 'GetTeamAvailability'],
  });
}

/**
 * Hook to delete availability
 */
export function useDeleteAvailability() {
  return useMutation<{ deleteAvailability: boolean }, { id: string }>(DELETE_AVAILABILITY, {
    refetchQueries: ['GetMyAvailabilities', 'GetTeamAvailability'],
  });
}

/**
 * Hook to trigger OOO reassignments
 */
export function useProcessOOOReassignments() {
  return useMutation(PROCESS_OOO_REASSIGNMENTS);
}
