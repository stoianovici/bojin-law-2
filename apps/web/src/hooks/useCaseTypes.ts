/**
 * Hook for fetching and managing case types
 * Provides dynamic case type fetching and creation
 */

import { useMemo, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

// GraphQL Query for fetching case types
const GET_CASE_TYPES = gql`
  query GetCaseTypes($includeInactive: Boolean) {
    caseTypes(includeInactive: $includeInactive) {
      id
      name
      code
      isActive
      sortOrder
    }
  }
`;

// GraphQL Mutation for creating a new case type
const CREATE_CASE_TYPE = gql`
  mutation CreateCaseType($input: CreateCaseTypeInput!) {
    createCaseType(input: $input) {
      id
      name
      code
      isActive
      sortOrder
    }
  }
`;

export interface CaseTypeOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

interface UseCaseTypesOptions {
  includeInactive?: boolean;
}

export function useCaseTypes(options: UseCaseTypesOptions = {}) {
  const { includeInactive = false } = options;

  const { data, loading, error, refetch } = useQuery<{ caseTypes: CaseTypeOption[] }>(
    GET_CASE_TYPES,
    {
      variables: { includeInactive },
      fetchPolicy: 'cache-and-network',
    }
  );

  const [createCaseTypeMutation, { loading: createLoading }] = useMutation(CREATE_CASE_TYPE);

  const caseTypes = useMemo(() => {
    return data?.caseTypes ?? [];
  }, [data?.caseTypes]);

  const createCaseType = useCallback(async (name: string, code: string): Promise<{ success: boolean; caseType?: CaseTypeOption; error?: string }> => {
    try {
      const result = await createCaseTypeMutation({
        variables: {
          input: { name, code },
        },
      });

      if (result.data?.createCaseType) {
        // Refetch to update the list
        await refetch();
        return { success: true, caseType: result.data.createCaseType };
      }

      return { success: false, error: 'Eroare la crearea tipului de dosar' };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
      return { success: false, error: errorMessage };
    }
  }, [createCaseTypeMutation, refetch]);

  return {
    caseTypes,
    loading,
    error,
    createCaseType,
    createLoading,
    refetch,
  };
}
