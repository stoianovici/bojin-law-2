/**
 * Case Approval Mutation Hooks
 * Story 2.8.2: Case Approval Workflow - Tasks 17 & 18
 *
 * Mutations for approving and rejecting cases in the approval workflow
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Case } from '@legal-platform/types';

// GraphQL mutation for approving a case
const APPROVE_CASE = gql`
  mutation ApproveCase($caseId: UUID!) {
    approveCase(caseId: $caseId) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
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
      client {
        id
        name
        email
        phone
      }
      teamMembers {
        id
        userId
        caseId
        role
        assignedAt
        user {
          id
          email
          firstName
          lastName
          role
        }
      }
      approval {
        id
        caseId
        submittedBy {
          id
          email
          firstName
          lastName
          role
        }
        submittedAt
        reviewedBy {
          id
          email
          firstName
          lastName
          role
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
      updatedAt
    }
  }
`;

// GraphQL mutation for rejecting a case
const REJECT_CASE = gql`
  mutation RejectCase($input: RejectCaseInput!) {
    rejectCase(input: $input) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
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
      client {
        id
        name
        email
        phone
      }
      teamMembers {
        id
        userId
        caseId
        role
        assignedAt
        user {
          id
          email
          firstName
          lastName
          role
        }
      }
      approval {
        id
        caseId
        submittedBy {
          id
          email
          firstName
          lastName
          role
        }
        submittedAt
        reviewedBy {
          id
          email
          firstName
          lastName
          role
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
      updatedAt
    }
  }
`;

interface ApproveCaseVariables {
  caseId: string;
}

interface ApproveCaseResult {
  approveCase: Case;
}

interface RejectCaseInput {
  caseId: string;
  reason: string;
}

interface RejectCaseVariables {
  input: RejectCaseInput;
}

interface RejectCaseResult {
  rejectCase: Case;
}

interface UseCaseApproveResult {
  approveCase: (caseId: string) => Promise<Case>;
  loading: boolean;
  error?: Error;
}

interface UseCaseRejectResult {
  rejectCase: (caseId: string, reason: string) => Promise<Case>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to approve a pending case (Partners only)
 * Story 2.8.2 Task 17: Implement Approval Action
 *
 * @returns approveCase function, loading state, and error
 */
export function useCaseApprove(): UseCaseApproveResult {
  const [mutate, { loading, error }] = useMutation<ApproveCaseResult, ApproveCaseVariables>(
    APPROVE_CASE,
    {
      // Refetch pending cases list and all cases after approval
      refetchQueries: ['GetPendingCases', 'GetCases', 'GetCase'],
    }
  );

  const approveCase = async (caseId: string): Promise<Case> => {
    const result = await mutate({
      variables: { caseId },
    });

    if (!result.data) {
      throw new Error('Failed to approve case');
    }

    return result.data.approveCase;
  };

  return {
    approveCase,
    loading,
    error: error as Error | undefined,
  };
}

/**
 * Hook to reject a pending case with feedback (Partners only)
 * Story 2.8.2 Task 18: Implement Rejection Action
 *
 * @returns rejectCase function, loading state, and error
 */
export function useCaseReject(): UseCaseRejectResult {
  const [mutate, { loading, error }] = useMutation<RejectCaseResult, RejectCaseVariables>(
    REJECT_CASE,
    {
      // Refetch pending cases list and all cases after rejection
      refetchQueries: ['GetPendingCases', 'GetCases', 'GetCase'],
    }
  );

  const rejectCase = async (caseId: string, reason: string): Promise<Case> => {
    // Validate reason length (minimum 10 characters)
    if (!reason || reason.trim().length < 10) {
      throw new Error('Rejection reason must be at least 10 characters');
    }

    const result = await mutate({
      variables: {
        input: {
          caseId,
          reason: reason.trim(),
        },
      },
    });

    if (!result.data) {
      throw new Error('Failed to reject case');
    }

    return result.data.rejectCase;
  };

  return {
    rejectCase,
    loading,
    error: error as Error | undefined,
  };
}
