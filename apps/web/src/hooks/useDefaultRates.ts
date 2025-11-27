/**
 * useDefaultRates Hook
 * Story 2.8.1: Billing & Rate Management - Task 10
 *
 * Hook for fetching and updating default billing rates.
 * Partners only - financial data.
 */

'use client';

import { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// GraphQL mutation
const UPDATE_DEFAULT_RATES = gql`
  mutation UpdateDefaultRates($input: DefaultRatesInput!) {
    updateDefaultRates(input: $input) {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

// GraphQL query
const GET_DEFAULT_RATES = gql`
  query GetDefaultRates {
    defaultRates {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

interface DefaultRates {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

interface UpdateDefaultRatesInput {
  partnerRate: number;
  associateRate: number;
  paralegalRate: number;
}

interface UpdateResult {
  success: boolean;
  rates?: DefaultRates;
  error?: string;
}

// GraphQL response types
interface UpdateDefaultRatesMutationResult {
  updateDefaultRates: DefaultRates;
}

interface GetDefaultRatesQueryResult {
  defaultRates: DefaultRates | null;
}

/**
 * Hook to update default billing rates
 */
export function useUpdateDefaultRates() {
  const [loading, setLoading] = useState(false);
  const [updateDefaultRatesMutation] = useMutation<UpdateDefaultRatesMutationResult>(UPDATE_DEFAULT_RATES);

  const updateDefaultRates = async (input: UpdateDefaultRatesInput): Promise<UpdateResult> => {
    setLoading(true);

    try {
      const result = await updateDefaultRatesMutation({
        variables: { input },
        refetchQueries: [{ query: GET_DEFAULT_RATES }],
        awaitRefetchQueries: true,
      });

      const { data } = result;

      if (data?.updateDefaultRates) {
        return {
          success: true,
          rates: data.updateDefaultRates,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
      };
    } catch (error: any) {
      console.error('Error updating default rates:', error);

      // Extract GraphQL error message if available
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const gqlError = error.graphQLErrors[0];
        const code = gqlError.extensions?.code;

        if (code === 'FORBIDDEN') {
          return {
            success: false,
            error: 'You do not have permission to update rates. Partner role required.',
          };
        }

        if (code === 'BAD_USER_INPUT') {
          return {
            success: false,
            error: gqlError.message || 'Invalid rate values. Please check your input.',
          };
        }

        return {
          success: false,
          error: gqlError.message,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to update rates',
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    updateDefaultRates,
    loading,
  };
}

/**
 * Hook to fetch default billing rates
 */
export function useDefaultRates() {
  const { data, loading, error, refetch } = useQuery<GetDefaultRatesQueryResult>(GET_DEFAULT_RATES);

  return {
    rates: data?.defaultRates || null,
    loading,
    error,
    refetch,
  };
}
