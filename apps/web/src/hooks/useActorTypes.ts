/**
 * Hook for fetching and managing actor types
 * Provides dynamic actor type fetching and creation
 * Returns merged list of built-in types + custom firm-specific types
 */

import { useMemo, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_ACTOR_TYPES = gql`
  query GetActorTypes($includeInactive: Boolean) {
    actorTypes(includeInactive: $includeInactive) {
      id
      code
      name
      isBuiltIn
      isActive
      sortOrder
    }
  }
`;

const CREATE_ACTOR_TYPE = gql`
  mutation CreateActorType($input: CreateActorTypeInput!) {
    createActorType(input: $input) {
      id
      code
      name
      isActive
      sortOrder
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface ActorType {
  id: string;
  code: string;
  name: string;
  isBuiltIn: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ActorTypeOption {
  value: string; // code
  label: string; // name (Romanian)
  isBuiltIn: boolean;
}

interface UseActorTypesOptions {
  includeInactive?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useActorTypes(options: UseActorTypesOptions = {}) {
  const { includeInactive = false } = options;

  const { data, loading, error, refetch } = useQuery<{ actorTypes: ActorType[] }>(GET_ACTOR_TYPES, {
    variables: { includeInactive },
    fetchPolicy: 'cache-and-network',
  });

  const [createActorTypeMutation, { loading: createLoading }] = useMutation<{
    createActorType: ActorType;
  }>(CREATE_ACTOR_TYPE);

  const actorTypes = useMemo(() => {
    return data?.actorTypes ?? [];
  }, [data?.actorTypes]);

  const actorTypeOptions = useMemo(() => {
    return actorTypes.map((type) => ({
      value: type.code,
      label: type.name,
      isBuiltIn: type.isBuiltIn,
    }));
  }, [actorTypes]);

  const createActorType = useCallback(
    async (name: string, code: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await createActorTypeMutation({
          variables: {
            input: { name, code },
          },
        });

        if (result.data?.createActorType) {
          // Refetch to update the list
          await refetch();
          return { success: true };
        }

        return { success: false, error: 'Eroare la crearea tipului de actor' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [createActorTypeMutation, refetch]
  );

  return {
    actorTypes,
    actorTypeOptions,
    loading,
    error,
    createActorType,
    createLoading,
    refetch,
  };
}
