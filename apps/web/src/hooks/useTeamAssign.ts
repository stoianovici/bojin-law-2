/**
 * Team Assignment Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 12
 *
 * Assigns a user to a case team with a specific role
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * GraphQL Mutation: Assign Team Member
 */
const ASSIGN_TEAM_MUTATION = gql`
  mutation AssignTeam($input: AssignTeamInput!) {
    assignTeam(input: $input) {
      id
      caseId
      userId
      role
      assignedAt
      user {
        id
        firstName
        lastName
        email
        role
      }
    }
  }
`;

/**
 * Input type for team assignment
 */
export interface AssignTeamInput {
  caseId: string;
  userId: string;
  role: string;
}

/**
 * Hook for assigning a team member to a case
 */
export function useTeamAssign() {
  const { addNotification } = useNotificationStore();

  const [assignTeamMutation, { loading, error }] = useMutation(ASSIGN_TEAM_MUTATION, {
    onCompleted: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Team member assigned successfully',
      });
    },
    onError: (error) => {
      // Map GraphQL error codes to user-friendly messages
      let message = 'Failed to assign team member';

      if (error.message.includes('FORBIDDEN')) {
        message = "You don't have permission to assign team members";
      } else if (error.message.includes('NOT_FOUND')) {
        message = 'Case or user not found';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        message = 'Invalid input. Please check the user ID and role.';
      } else if (error.message.includes('already assigned')) {
        message = 'This user is already assigned to the case';
      }

      addNotification({
        type: 'error',
        title: 'Error',
        message,
      });
    },
    // Refetch case query to update team members list
    refetchQueries: ['GetCase'],
  });

  const assignTeam = async (input: AssignTeamInput) => {
    try {
      const result = await assignTeamMutation({ variables: { input } });
      return (result.data as any)?.assignTeam;
    } catch (err) {
      // Error already handled by onError callback
      throw err;
    }
  };

  return {
    assignTeam,
    loading,
    error,
  };
}
