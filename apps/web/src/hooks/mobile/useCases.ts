'use client';

import { useQuery } from '@apollo/client/react';
import { GET_CASES } from '@/graphql/queries';
import type { CaseStatus } from '@/store/casesStore';
import type { Case } from '@/components/cases';

interface UseCasesOptions {
  status?: CaseStatus;
  assignedToMe?: boolean;
}

interface GetCasesData {
  cases: Case[];
}

interface GetCasesVariables {
  status?: CaseStatus;
  assignedToMe?: boolean;
}

export function useCases(options: UseCasesOptions = {}) {
  const { status, assignedToMe } = options;

  const { data, loading, error, refetch } = useQuery<GetCasesData, GetCasesVariables>(GET_CASES, {
    variables: {
      status,
      assignedToMe,
    },
    fetchPolicy: 'cache-and-network',
  });

  return {
    cases: data?.cases ?? [],
    loading,
    error,
    refetch,
  };
}
