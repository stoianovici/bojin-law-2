/**
 * Case Actor Update Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 13
 *
 * Updates an existing case actor
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * GraphQL Mutation: Update Case Actor
 */
const UPDATE_CASE_ACTOR_MUTATION = gql`
  mutation UpdateCaseActor($id: UUID!, $input: UpdateCaseActorInput!) {
    updateCaseActor(id: $id, input: $input) {
      id
      caseId
      role
      name
      organization
      email
      phone
      address
      notes
      createdAt
      updatedAt
      createdBy
    }
  }
`;

/**
 * Input type for updating a case actor
 */
export interface UpdateCaseActorInput {
  name?: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Hook for updating a case actor
 */
export function useActorUpdate() {
  const { addNotification } = useNotificationStore();

  const [updateCaseActorMutation, { loading, error }] = useMutation(
    UPDATE_CASE_ACTOR_MUTATION,
    {
      onCompleted: () => {
        addNotification({
          type: 'success',
          title: 'Success',
          message: 'Case actor updated successfully',
        });
      },
      onError: (error) => {
        // Map GraphQL error codes to user-friendly messages
        let message = 'Failed to update case actor';

        if (error.message.includes('FORBIDDEN')) {
          message = "You don't have permission to update case actors";
        } else if (error.message.includes('NOT_FOUND')) {
          message = 'Case actor not found';
        } else if (error.message.includes('BAD_USER_INPUT')) {
          message = 'Invalid input. Please check the actor details.';
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

  const updateActor = async (id: string, input: UpdateCaseActorInput) => {
    try {
      const result = await updateCaseActorMutation({ variables: { id, input } });
      return (result.data as any)?.updateCaseActor;
    } catch (err) {
      // Error already handled by onError callback
      throw err;
    }
  };

  return {
    updateActor,
    loading,
    error,
  };
}
