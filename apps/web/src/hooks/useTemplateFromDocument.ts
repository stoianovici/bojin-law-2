/**
 * useTemplateFromDocument Hook
 * Copies a document as a template to another case, returning Word URL for opening
 */

import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';

// ============================================================================
// GraphQL Mutation
// ============================================================================

const COPY_DOCUMENT_AS_TEMPLATE = gql`
  mutation CopyDocumentAsTemplate($documentId: UUID!, $targetCaseId: UUID!) {
    copyDocumentAsTemplate(documentId: $documentId, targetCaseId: $targetCaseId) {
      success
      newDocumentId
      wordUrl
      message
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface CopyResult {
  success: boolean;
  newDocumentId: string;
  wordUrl: string;
  message?: string;
}

export interface UseTemplateFromDocumentReturn {
  copyAsTemplate: (documentId: string, targetCaseId: string) => Promise<CopyResult | null>;
  loading: boolean;
  error: Error | null;
}

// Mutation response type
interface CopyDocumentAsTemplateMutationResult {
  copyDocumentAsTemplate?: CopyResult;
}

// ============================================================================
// Hook
// ============================================================================

export function useTemplateFromDocument(): UseTemplateFromDocumentReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [copyDocumentAsTemplateMutation] =
    useMutation<CopyDocumentAsTemplateMutationResult>(COPY_DOCUMENT_AS_TEMPLATE);

  /**
   * Copy a document as a template to another case
   * Returns the copy result with wordUrl for opening in Word
   */
  const copyAsTemplate = useCallback(
    async (documentId: string, targetCaseId: string): Promise<CopyResult | null> => {
      // Clear previous error before new request
      setError(null);
      setLoading(true);

      try {
        const result = await copyDocumentAsTemplateMutation({
          variables: { documentId, targetCaseId },
        });

        const copyResult = result.data?.copyDocumentAsTemplate;

        if (!copyResult) {
          throw new Error('No response from server');
        }

        return copyResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy document as template');
        setError(error);
        console.error('Failed to copy document as template:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [copyDocumentAsTemplateMutation]
  );

  return {
    copyAsTemplate,
    loading,
    error,
  };
}

export default useTemplateFromDocument;
