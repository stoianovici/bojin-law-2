/**
 * Case Metadata Update Hook
 * OPS-038: Contacts & Metadata in Case Flow
 *
 * Hook for updating case classification metadata (reference numbers, keywords, etc.)
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';

// ============================================================================
// GraphQL Mutations
// ============================================================================

const UPDATE_CASE_METADATA = gql`
  mutation UpdateCaseMetadata($caseId: UUID!, $input: CaseMetadataInput!) {
    updateCaseMetadata(caseId: $caseId, input: $input) {
      id
      referenceNumbers
      keywords
      subjectPatterns
      classificationNotes
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface CaseMetadataInput {
  referenceNumbers?: string[];
  keywords?: string[];
  subjectPatterns?: string[];
  classificationNotes?: string | null;
}

interface UpdateCaseMetadataResult {
  updateCaseMetadata: {
    id: string;
    referenceNumbers: string[];
    keywords: string[];
    subjectPatterns: string[];
    classificationNotes: string | null;
  };
}

interface UseCaseMetadataResult {
  updateMetadata: (caseId: string, input: CaseMetadataInput) => Promise<void>;
  loading: boolean;
  error?: Error;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for updating case classification metadata
 */
export function useCaseMetadata(): UseCaseMetadataResult {
  const [mutate, { loading, error }] = useMutation<
    UpdateCaseMetadataResult,
    { caseId: string; input: CaseMetadataInput }
  >(UPDATE_CASE_METADATA, {
    refetchQueries: ['GetCase'],
  });

  const updateMetadata = async (caseId: string, input: CaseMetadataInput): Promise<void> => {
    await mutate({
      variables: { caseId, input },
    });
  };

  return {
    updateMetadata,
    loading,
    error: error as Error | undefined,
  };
}
