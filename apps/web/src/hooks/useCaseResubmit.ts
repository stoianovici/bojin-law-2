/**
 * Resubmit Case Mutation Hook
 * Story 2.8.2: Case Approval Workflow - Task 14
 *
 * Hook for Associates to resubmit rejected cases for approval
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Case } from '@legal-platform/types';

// GraphQL mutation for resubmitting a case
const RESUBMIT_CASE = gql`
  mutation ResubmitCase($caseId: UUID!) {
    resubmitCase(caseId: $caseId) {
      id
      caseNumber
      title
      status
      approval {
        id
        submittedAt
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
    }
  }
`;

export interface ResubmitCaseVariables {
  caseId: string;
}

interface ResubmitCaseResult {
  resubmitCase: Case;
}

export interface ResubmitCaseResponse {
  success: boolean;
  case?: Case;
  error?: string;
}

export interface UseCaseResubmitResult {
  resubmitCase: (caseId: string) => Promise<ResubmitCaseResponse>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to resubmit a rejected case for approval
 * @returns resubmitCase function, loading state, and error
 */
export function useCaseResubmit(): UseCaseResubmitResult {
  const [mutate, { loading, error }] = useMutation<ResubmitCaseResult, ResubmitCaseVariables>(
    RESUBMIT_CASE,
    {
      // Refetch case and related queries after resubmission
      refetchQueries: ['GetCase', 'MyCases', 'PendingCases'],
      awaitRefetchQueries: true,
    }
  );

  const resubmitCase = async (caseId: string): Promise<ResubmitCaseResponse> => {
    try {
      const result = await mutate({
        variables: { caseId },
      });

      if (!result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to resubmit case. No data returned.',
        };
      }

      return {
        success: true,
        case: result.data.resubmitCase,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return {
    resubmitCase,
    loading,
    error: error as Error | undefined,
  };
}
