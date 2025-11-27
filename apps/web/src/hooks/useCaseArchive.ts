/**
 * Archive Case Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 14
 *
 * Mutation for archiving a case (Partners only)
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Case } from '@legal-platform/types';

// GraphQL mutation for archiving a case
const ARCHIVE_CASE = gql`
  mutation ArchiveCase($id: UUID!) {
    archiveCase(id: $id) {
      id
      status
      closedDate
      updatedAt
    }
  }
`;

interface ArchiveCaseVariables {
  id: string;
}

interface ArchiveCaseResult {
  archiveCase: Case;
}

interface UseCaseArchiveResult {
  archiveCase: (id: string) => Promise<Case>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to archive a case
 * Only Partners can archive cases
 * Case must be in Closed status to archive
 * @returns archiveCase function, loading state, and error
 */
export function useCaseArchive(): UseCaseArchiveResult {
  const [mutate, { loading, error }] = useMutation<ArchiveCaseResult, ArchiveCaseVariables>(
    ARCHIVE_CASE,
    {
      // Refetch case detail and cases list
      refetchQueries: ['GetCase', 'GetCases'],
    }
  );

  const archiveCase = async (id: string): Promise<Case> => {
    const result = await mutate({
      variables: { id },
    });

    if (!result.data) {
      throw new Error('Failed to archive case');
    }

    return result.data.archiveCase;
  };

  return {
    archiveCase,
    loading,
    error: error as Error | undefined,
  };
}
