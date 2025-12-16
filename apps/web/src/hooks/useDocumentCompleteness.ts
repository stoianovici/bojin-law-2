/**
 * Document Completeness React Hooks
 * Story 5.4: Proactive AI Suggestions System (Task 30)
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import type { CompletenessCheckResult, MissingItem } from '@legal-platform/types';

// ====================
// GraphQL Queries
// ====================

const GET_DOCUMENT_COMPLETENESS = gql`
  query GetDocumentCompleteness($input: DocumentCompletenessInput!) {
    documentCompleteness(input: $input) {
      documentId
      documentType
      completenessScore
      missingItems {
        item
        severity
        section
        suggestion
      }
      suggestions
    }
  }
`;

const MARK_COMPLETENESS_RESOLVED = gql`
  mutation MarkCompletenessResolved($checkId: ID!) {
    markCompletenessResolved(checkId: $checkId)
  }
`;

// ====================
// Types
// ====================

export interface DocumentCompletenessInput {
  documentId: string;
  documentContent: string;
  documentType: string;
  documentTitle?: string;
}

export interface CompletenessResult {
  documentId: string;
  documentType: string;
  completenessScore: number;
  missingItems: MissingItem[];
  suggestions: string[];
}

// ====================
// Hooks
// ====================

/**
 * Hook to check document completeness
 * Fetches on document view and caches for 10 minutes
 */
export function useDocumentCompleteness(input: DocumentCompletenessInput | null) {
  const { data, loading, error, refetch } = useQuery<{
    documentCompleteness: CompletenessResult;
  }>(GET_DOCUMENT_COMPLETENESS, {
    variables: { input },
    skip: !input || !input.documentId || !input.documentContent,
    fetchPolicy: 'cache-first',
    // Cache for 10 minutes
    pollInterval: 0,
  });

  // Group missing items by severity
  const groupedMissingItems = useMemo(() => {
    const items = data?.documentCompleteness?.missingItems ?? [];
    return {
      required: items.filter((i) => i.severity === 'required'),
      recommended: items.filter((i) => i.severity === 'recommended'),
      optional: items.filter((i) => i.severity === 'optional'),
    };
  }, [data?.documentCompleteness?.missingItems]);

  // Calculate score color
  const scoreColor = useMemo(() => {
    const score = data?.documentCompleteness?.completenessScore ?? 0;
    if (score >= 0.9) return 'green';
    if (score >= 0.7) return 'yellow';
    return 'red';
  }, [data?.documentCompleteness?.completenessScore]);

  return {
    completeness: data?.documentCompleteness ?? null,
    score: data?.documentCompleteness?.completenessScore ?? 0,
    scorePercentage: Math.round((data?.documentCompleteness?.completenessScore ?? 0) * 100),
    scoreColor,
    missingItems: data?.documentCompleteness?.missingItems ?? [],
    groupedMissingItems,
    suggestions: data?.documentCompleteness?.suggestions ?? [],
    loading,
    error,
    refetch: () => refetch({ input }),
    hasIssues: (data?.documentCompleteness?.missingItems?.length ?? 0) > 0,
    requiredCount: groupedMissingItems.required.length,
    isComplete: groupedMissingItems.required.length === 0,
  };
}

/**
 * Hook for lazy completeness check (triggered manually)
 */
export function useCheckDocumentCompleteness() {
  const [checkCompleteness, { data, loading, error }] = useMutation<
    { documentCompleteness: CompletenessResult },
    { input: DocumentCompletenessInput }
  >(gql`
    query CheckDocumentCompleteness($input: DocumentCompletenessInput!) {
      documentCompleteness(input: $input) {
        documentId
        documentType
        completenessScore
        missingItems {
          item
          severity
          section
          suggestion
        }
        suggestions
      }
    }
  `);

  const check = async (input: DocumentCompletenessInput) => {
    const result = await checkCompleteness({ variables: { input } });
    return result.data?.documentCompleteness;
  };

  return {
    checkCompleteness: check,
    result: data?.documentCompleteness ?? null,
    loading,
    error,
  };
}

/**
 * Hook to mark a completeness issue as resolved
 */
export function useMarkCompletenessResolved() {
  const [markResolved, { loading, error }] = useMutation<
    { markCompletenessResolved: boolean },
    { checkId: string }
  >(MARK_COMPLETENESS_RESOLVED, {
    refetchQueries: ['GetDocumentCompleteness'],
  });

  const markCompletenessResolved = async (checkId: string) => {
    const result = await markResolved({ variables: { checkId } });
    return result.data?.markCompletenessResolved ?? false;
  };

  return {
    markCompletenessResolved,
    loading,
    error,
  };
}

/**
 * Combined hook for complete document completeness management
 */
export function useDocumentCompletenessManagement(
  documentId: string,
  documentContent: string,
  documentType: string,
  documentTitle?: string
) {
  const input = useMemo(
    () =>
      documentId && documentContent
        ? { documentId, documentContent, documentType, documentTitle }
        : null,
    [documentId, documentContent, documentType, documentTitle]
  );

  const completeness = useDocumentCompleteness(input);
  const { markCompletenessResolved, loading: resolving } = useMarkCompletenessResolved();

  return {
    ...completeness,
    markCompletenessResolved,
    resolving,
    // Convenience methods
    refreshCompleteness: completeness.refetch,
    isChecking: completeness.loading,
  };
}

/**
 * Hook to get completeness summary for multiple documents
 * Useful for document lists
 */
export function useDocumentsCompleteness(
  documents: Array<{
    id: string;
    content: string;
    type: string;
    title?: string;
  }>
) {
  // This is a simplified version - in production you might want
  // to batch these requests or use a dedicated endpoint
  const results = documents.map((doc) =>
    useDocumentCompleteness({
      documentId: doc.id,
      documentContent: doc.content,
      documentType: doc.type,
      documentTitle: doc.title,
    })
  );

  const summary = useMemo(() => {
    const complete = results.filter((r) => r.isComplete).length;
    const incomplete = results.filter((r) => !r.isComplete && !r.loading).length;
    const loading = results.filter((r) => r.loading).length;
    const withIssues = results.filter((r) => r.hasIssues).length;

    return {
      total: documents.length,
      complete,
      incomplete,
      loading,
      withIssues,
      averageScore:
        results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
    };
  }, [results, documents.length]);

  return {
    results,
    summary,
    isLoading: summary.loading > 0,
  };
}
