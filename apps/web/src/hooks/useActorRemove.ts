/**
 * Case Actor Remove Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 13
 *
 * Removes an actor from a case
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * GraphQL Mutation: Remove Case Actor
 */
const REMOVE_CASE_ACTOR_MUTATION = gql`
  mutation RemoveCaseActor($id: UUID!) {
    removeCaseActor(id: $id)
  }
`;

/**
 * Hook for removing a case actor
 */
export function useActorRemove() {
  const { addNotification } = useNotificationStore();

  const [removeCaseActorMutation, { loading, error }] = useMutation(
    REMOVE_CASE_ACTOR_MUTATION,
    {
      onCompleted: () => {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Case actor removed successfully',
        });
      },
      onError: (error) => {
        // Map GraphQL error codes to user-friendly messages
        let message = 'Failed to remove case actor';

        if (error.message.includes('FORBIDDEN')) {
          message = "You don't have permission to remove case actors";
        } else if (error.message.includes('NOT_FOUND')) {
          message = 'Case actor not found';
        } else if (error.message.includes('BAD_USER_INPUT')) {
          message = 'Invalid input. Cannot remove this actor.';
        }

        addNotification({
          type: 'error',
          title: 'Error',
          message,
        });
      },
      // Refetch case query to update actors list
      refetchQueries: ['GetCase'],
    }
  );

  const removeActor = async (id: string) => {
    try {
      const result = await removeCaseActorMutation({ variables: { id } });
      return (result.data as any)?.removeCaseActor;
    } catch (err) {
      // Error already handled by onError callback
      throw err;
    }
  };

  return {
    removeActor,
    loading,
    error,
  };
}
