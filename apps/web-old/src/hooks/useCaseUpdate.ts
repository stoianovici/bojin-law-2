/**
 * Update Case Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 11
 *
 * Mutation for updating an existing case
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Case, CaseStatus, BillingType, CustomRates } from '@legal-platform/types';

// GraphQL mutation for updating a case
const UPDATE_CASE = gql`
  mutation UpdateCase($id: UUID!, $input: UpdateCaseInput!) {
    updateCase(id: $id, input: $input) {
      id
      caseNumber
      title
      status
      type
      description
      closedDate
      value
      metadata
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      updatedAt
    }
  }
`;

export interface UpdateCaseInput {
  title?: string;
  caseNumber?: string;
  status?: CaseStatus;
  type?: string; // Dynamic case type code
  description?: string;
  closedDate?: Date;
  value?: number;
  metadata?: Record<string, unknown>;
  billingType?: BillingType;
  fixedAmount?: number | null;
  customRates?: CustomRates | null;
}

interface UpdateCaseVariables {
  id: string;
  input: UpdateCaseInput;
}

interface UpdateCaseResult {
  updateCase: Case;
}

interface UseCaseUpdateResult {
  updateCase: (id: string, input: UpdateCaseInput) => Promise<Case>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to update an existing case
 * @returns updateCase function, loading state, and error
 */
export function useCaseUpdate(): UseCaseUpdateResult {
  const [mutate, { loading, error }] = useMutation<UpdateCaseResult, UpdateCaseVariables>(
    UPDATE_CASE,
    {
      // Refetch case detail and cases list
      refetchQueries: ['GetCase', 'GetCases'],
    }
  );

  const updateCase = async (id: string, input: UpdateCaseInput): Promise<Case> => {
    const result = await mutate({
      variables: { id, input },
    });

    if (!result.data) {
      throw new Error('Failed to update case');
    }

    return result.data.updateCase;
  };

  return {
    updateCase,
    loading,
    error: error as Error | undefined,
  };
}
