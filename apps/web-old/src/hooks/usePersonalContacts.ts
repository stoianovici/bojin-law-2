/**
 * Personal Contacts React Hook
 * OPS-193: Personal Contacts Profile Page
 *
 * Manages the personal contacts blocklist. Emails from these addresses won't be synced.
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useCallback } from 'react';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_PERSONAL_CONTACTS = gql`
  query GetPersonalContacts {
    personalContacts {
      id
      email
      createdAt
    }
  }
`;

const REMOVE_PERSONAL_CONTACT = gql`
  mutation RemovePersonalContact($email: String!) {
    removePersonalContact(email: $email)
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface PersonalContact {
  id: string;
  email: string;
  createdAt: string;
}

interface GetPersonalContactsResult {
  personalContacts: PersonalContact[];
}

interface RemovePersonalContactResult {
  removePersonalContact: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to manage personal contacts blocklist
 */
export function usePersonalContacts() {
  const { data, loading, error, refetch } = useQuery<GetPersonalContactsResult>(
    GET_PERSONAL_CONTACTS,
    {
      fetchPolicy: 'cache-and-network',
    }
  );

  const [removeContactMutation, { loading: removing }] = useMutation<
    RemovePersonalContactResult,
    { email: string }
  >(REMOVE_PERSONAL_CONTACT, {
    refetchQueries: ['GetPersonalContacts'],
    awaitRefetchQueries: true,
  });

  const removeContact = useCallback(
    async (email: string): Promise<boolean> => {
      try {
        const result = await removeContactMutation({ variables: { email } });
        return result.data?.removePersonalContact ?? false;
      } catch (err) {
        console.error('Failed to remove personal contact:', err);
        throw err;
      }
    },
    [removeContactMutation]
  );

  return {
    contacts: data?.personalContacts ?? [],
    loading,
    removing,
    error,
    removeContact,
    refetch,
    count: data?.personalContacts?.length ?? 0,
  };
}
