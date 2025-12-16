/**
 * Hook for fetching and managing global email sources
 * OPS-028: Classification Metadata UI
 *
 * Provides CRUD operations for firm-level email source configuration
 * Used by AI email classification to identify institutional senders
 */

import { useMemo, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';

// ============================================================================
// GraphQL Operations
// ============================================================================

const GET_GLOBAL_EMAIL_SOURCES = gql`
  query GetGlobalEmailSources {
    globalEmailSources {
      id
      firmId
      category
      name
      domains
      emails
      classificationHint
      createdAt
      updatedAt
    }
  }
`;

const CREATE_GLOBAL_EMAIL_SOURCE = gql`
  mutation CreateGlobalEmailSource($input: CreateGlobalEmailSourceInput!) {
    createGlobalEmailSource(input: $input) {
      id
      firmId
      category
      name
      domains
      emails
      classificationHint
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_GLOBAL_EMAIL_SOURCE = gql`
  mutation UpdateGlobalEmailSource($id: UUID!, $input: UpdateGlobalEmailSourceInput!) {
    updateGlobalEmailSource(id: $id, input: $input) {
      id
      firmId
      category
      name
      domains
      emails
      classificationHint
      createdAt
      updatedAt
    }
  }
`;

const DELETE_GLOBAL_EMAIL_SOURCE = gql`
  mutation DeleteGlobalEmailSource($id: UUID!) {
    deleteGlobalEmailSource(id: $id)
  }
`;

// ============================================================================
// Types
// ============================================================================

export type GlobalEmailSourceCategory = 'Court' | 'Notary' | 'Bailiff' | 'Authority' | 'Other';

export interface GlobalEmailSource {
  id: string;
  firmId: string;
  category: GlobalEmailSourceCategory;
  name: string;
  domains: string[];
  emails: string[];
  classificationHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGlobalEmailSourceInput {
  category: GlobalEmailSourceCategory;
  name: string;
  domains?: string[];
  emails?: string[];
  classificationHint?: string;
}

export interface UpdateGlobalEmailSourceInput {
  category?: GlobalEmailSourceCategory;
  name?: string;
  domains?: string[];
  emails?: string[];
  classificationHint?: string;
}

interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Category Labels (Romanian)
// ============================================================================

export const CATEGORY_LABELS: Record<GlobalEmailSourceCategory, string> = {
  Court: 'Instanță',
  Notary: 'Notar',
  Bailiff: 'Executor Judecătoresc',
  Authority: 'Autoritate',
  Other: 'Altele',
};

export const CATEGORY_ICONS: Record<GlobalEmailSourceCategory, string> = {
  Court: '⚖️',
  Notary: '📜',
  Bailiff: '⚡',
  Authority: '🏛️',
  Other: '📧',
};

// ============================================================================
// Hook
// ============================================================================

export function useGlobalEmailSources() {
  const { data, loading, error, refetch } = useQuery<{
    globalEmailSources: GlobalEmailSource[];
  }>(GET_GLOBAL_EMAIL_SOURCES, {
    fetchPolicy: 'cache-and-network',
  });

  const [createMutation, { loading: createLoading }] = useMutation(CREATE_GLOBAL_EMAIL_SOURCE);
  const [updateMutation, { loading: updateLoading }] = useMutation(UPDATE_GLOBAL_EMAIL_SOURCE);
  const [deleteMutation, { loading: deleteLoading }] = useMutation(DELETE_GLOBAL_EMAIL_SOURCE);

  const sources = useMemo(() => {
    return data?.globalEmailSources ?? [];
  }, [data?.globalEmailSources]);

  // Group sources by category
  const sourcesByCategory = useMemo(() => {
    const grouped: Record<GlobalEmailSourceCategory, GlobalEmailSource[]> = {
      Court: [],
      Notary: [],
      Bailiff: [],
      Authority: [],
      Other: [],
    };

    sources.forEach((source) => {
      if (grouped[source.category]) {
        grouped[source.category].push(source);
      }
    });

    return grouped;
  }, [sources]);

  const createSource = useCallback(
    async (input: CreateGlobalEmailSourceInput): Promise<MutationResult<GlobalEmailSource>> => {
      try {
        const result = await createMutation({
          variables: { input },
        });

        if (result.data?.createGlobalEmailSource) {
          await refetch();
          return { success: true, data: result.data.createGlobalEmailSource };
        }

        return { success: false, error: 'Eroare la crearea sursei de email' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [createMutation, refetch]
  );

  const updateSource = useCallback(
    async (
      id: string,
      input: UpdateGlobalEmailSourceInput
    ): Promise<MutationResult<GlobalEmailSource>> => {
      try {
        const result = await updateMutation({
          variables: { id, input },
        });

        if (result.data?.updateGlobalEmailSource) {
          await refetch();
          return { success: true, data: result.data.updateGlobalEmailSource };
        }

        return { success: false, error: 'Eroare la actualizarea sursei de email' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [updateMutation, refetch]
  );

  const deleteSource = useCallback(
    async (id: string): Promise<MutationResult<boolean>> => {
      try {
        const result = await deleteMutation({
          variables: { id },
        });

        if (result.data?.deleteGlobalEmailSource) {
          await refetch();
          return { success: true, data: true };
        }

        return { success: false, error: 'Eroare la ștergerea sursei de email' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [deleteMutation, refetch]
  );

  return {
    sources,
    sourcesByCategory,
    loading,
    error,
    refetch,
    createSource,
    createLoading,
    updateSource,
    updateLoading,
    deleteSource,
    deleteLoading,
    mutating: createLoading || updateLoading || deleteLoading,
  };
}

// ============================================================================
// Hook for Case Classification Metadata
// ============================================================================

const UPDATE_CASE_CLASSIFICATION = gql`
  mutation UpdateCaseClassification($caseId: UUID!, $input: UpdateCaseClassificationInput!) {
    updateCaseClassification(caseId: $caseId, input: $input) {
      id
      keywords
      referenceNumbers
      subjectPatterns
      classificationNotes
    }
  }
`;

export interface CaseClassificationData {
  keywords: string[];
  referenceNumbers: string[];
  subjectPatterns: string[];
  classificationNotes: string | null;
}

export interface UpdateCaseClassificationInput {
  keywords?: string[];
  referenceNumbers?: string[];
  subjectPatterns?: string[];
  classificationNotes?: string;
}

export function useCaseClassification() {
  const [updateMutation, { loading }] = useMutation(UPDATE_CASE_CLASSIFICATION);

  const updateClassification = useCallback(
    async (
      caseId: string,
      input: UpdateCaseClassificationInput
    ): Promise<MutationResult<CaseClassificationData>> => {
      try {
        const result = await updateMutation({
          variables: { caseId, input },
        });

        if (result.data?.updateCaseClassification) {
          return {
            success: true,
            data: {
              keywords: result.data.updateCaseClassification.keywords || [],
              referenceNumbers: result.data.updateCaseClassification.referenceNumbers || [],
              subjectPatterns: result.data.updateCaseClassification.subjectPatterns || [],
              classificationNotes: result.data.updateCaseClassification.classificationNotes,
            },
          };
        }

        return { success: false, error: 'Eroare la actualizarea metadatelor de clasificare' };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
        return { success: false, error: errorMessage };
      }
    },
    [updateMutation]
  );

  return {
    updateClassification,
    loading,
  };
}
