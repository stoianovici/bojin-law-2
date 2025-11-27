/**
 * Create Case Mutation Hook
 * Story 2.8: Case CRUD Operations UI - Task 8
 * Story 2.8.1: Billing & Rate Management - Task 11
 *
 * Mutation for creating a new case with billing information
 */

import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Case, CaseType, BillingType } from '@legal-platform/types';

// GraphQL mutation for creating a case
const CREATE_CASE = gql`
  mutation CreateCase($input: CreateCaseInput!) {
    createCase(input: $input) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
      value
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
      }
      teamMembers {
        id
        userId
        role
        user {
          id
          firstName
          lastName
        }
      }
    }
  }
`;

export interface CustomRatesInput {
  partnerRate?: number;
  associateRate?: number;
  paralegalRate?: number;
}

export interface CreateCaseInput {
  title: string;
  clientId: string;
  type: CaseType;
  description: string;
  value?: number;
  metadata?: Record<string, unknown>;
  billingType: BillingType;
  fixedAmount?: number;
  customRates?: CustomRatesInput;
  submitForApproval?: boolean; // Story 2.8.2: For Associates, cases are submitted for approval
}

interface CreateCaseResult {
  createCase: Case;
}

export interface CreateCaseResponse {
  success: boolean;
  case?: Case;
  error?: string;
}

interface UseCaseCreateResult {
  createCase: (input: CreateCaseInput) => Promise<CreateCaseResponse>;
  loading: boolean;
  error?: Error;
}

/**
 * Hook to create a new case
 * @returns createCase function, loading state, and error
 */
export function useCaseCreate(): UseCaseCreateResult {
  const [mutate, { loading, error }] = useMutation<CreateCaseResult, { input: CreateCaseInput }>(
    CREATE_CASE,
    {
      // Refetch cases list after creating a case
      refetchQueries: ['GetCases'],
      awaitRefetchQueries: true,
    }
  );

  const createCase = async (input: CreateCaseInput): Promise<CreateCaseResponse> => {
    try {
      const result = await mutate({
        variables: { input },
      });

      if (!result.data) {
        return {
          success: false,
          error: result.error?.message || 'Failed to create case. No data returned.',
        };
      }

      return {
        success: true,
        case: result.data.createCase,
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
    createCase,
    loading,
    error: error as Error | undefined,
  };
}
