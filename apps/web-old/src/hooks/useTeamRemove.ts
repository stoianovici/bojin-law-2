/**
 * Team Member Removal Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 12
 *
 * Removes a user from a case team
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * GraphQL Mutation: Remove Team Member
 */
const REMOVE_TEAM_MEMBER_MUTATION = gql`
  mutation RemoveTeamMember($caseId: UUID!, $userId: UUID!) {
    removeTeamMember(caseId: $caseId, userId: $userId)
  }
`;

/**
 * Input for removing a team member
 */
export interface RemoveTeamMemberInput {
  caseId: string;
  userId: string;
}

/**
 * Hook for removing a team member from a case
 */
export function useTeamRemove() {
  const { addNotification } = useNotificationStore();

  const [removeTeamMemberMutation, { loading, error }] = useMutation(REMOVE_TEAM_MEMBER_MUTATION, {
    onCompleted: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Team member removed successfully',
      });
    },
    onError: (error) => {
      // Map GraphQL error codes to user-friendly messages
      let message = 'Failed to remove team member';

      if (error.message.includes('FORBIDDEN')) {
        message = "You don't have permission to remove team members";
      } else if (error.message.includes('NOT_FOUND')) {
        message = 'Case or team member not found';
      } else if (error.message.includes('BAD_USER_INPUT')) {
        message = 'Invalid input. Cannot remove this team member.';
      } else if (error.message.includes('last') || error.message.includes('Lead')) {
        message = 'Cannot remove the last Lead from the case';
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

  const removeTeamMember = async (input: RemoveTeamMemberInput) => {
    try {
      const result = await removeTeamMemberMutation({
        variables: { caseId: input.caseId, userId: input.userId },
      });
      return (result.data as any)?.removeTeamMember;
    } catch (err) {
      // Error already handled by onError callback
      throw err;
    }
  };

  return {
    removeTeamMember,
    loading,
    error,
  };
}
