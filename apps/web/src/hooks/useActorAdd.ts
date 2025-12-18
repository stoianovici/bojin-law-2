/**
 * Case Actor Add Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 13
 *
 * Adds an external actor to a case
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { useNotificationStore } from '../stores/notificationStore';
import type { CaseActorRole } from '@legal-platform/types';

/**
 * GraphQL Mutation: Add Case Actor
 * OPS-038: Added emailDomains field support
 */
const ADD_CASE_ACTOR_MUTATION = gql`
  mutation AddCaseActor($input: AddCaseActorInput!) {
    addCaseActor(input: $input) {
      id
      caseId
      role
      name
      organization
      email
      emailDomains
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
 * Input type for adding a case actor
 * OPS-038: Added emailDomains field
 */
export interface AddCaseActorInput {
  caseId: string;
  role: CaseActorRole;
  name: string;
  organization?: string;
  email?: string;
  emailDomains?: string[];
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Hook for adding a case actor
 */
export function useActorAdd() {
  const { addNotification } = useNotificationStore();

  const [addCaseActorMutation, { loading, error }] = useMutation(ADD_CASE_ACTOR_MUTATION, {
    onCompleted: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Case actor added successfully',
      });
    },
    onError: (error) => {
      // Map GraphQL error codes to user-friendly messages
      let message = 'Failed to add case actor';

      if (error.message.includes('FORBIDDEN')) {
        message = "You don't have permission to add case actors";
      } else if (error.message.includes('NOT_FOUND')) {
        message = 'Case not found';
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
  });

  const addActor = async (input: AddCaseActorInput) => {
    try {
      const result = await addCaseActorMutation({ variables: { input } });
      return (result.data as any)?.addCaseActor;
    } catch (err) {
      // Error already handled by onError callback
      throw err;
    }
  };

  return {
    addActor,
    loading,
    error,
  };
}
