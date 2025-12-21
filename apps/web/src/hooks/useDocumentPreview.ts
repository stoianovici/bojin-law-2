/**
 * useDocumentPreview Hook
 * Manages document preview modal state and preview URL fetching
 */

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import type { PreviewableDocument } from '@/components/preview';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: ID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
    }
  }
`;

const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: ID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

interface PreviewUrlResult {
  url: string;
  source: string;
  expiresAt?: string;
}

interface UseDocumentPreviewOptions {
  /** Type of preview: 'document' or 'attachment' */
  type?: 'document' | 'attachment';
}

interface UseDocumentPreviewReturn {
  /** Currently selected document for preview */
  selectedDocument: PreviewableDocument | null;
  /** Whether preview modal is open */
  isPreviewOpen: boolean;
  /** Open preview modal with a document */
  openPreview: (document: PreviewableDocument) => void;
  /** Close preview modal */
  closePreview: () => void;
  /** Fetch preview URL for a document */
  fetchPreviewUrl: (documentId: string) => Promise<string | null>;
  /** Loading state for preview URL fetch */
  loading: boolean;
  /** Error from preview URL fetch */
  error: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentPreview(
  options: UseDocumentPreviewOptions = {}
): UseDocumentPreviewReturn {
  const { type = 'document' } = options;

  const [selectedDocument, setSelectedDocument] = useState<PreviewableDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // GraphQL queries
  const [fetchDocumentPreview, { loading: docLoading, error: docError }] = useLazyQuery(
    GET_DOCUMENT_PREVIEW_URL,
    { fetchPolicy: 'network-only' }
  );

  const [fetchAttachmentPreview, { loading: attLoading, error: attError }] = useLazyQuery(
    GET_ATTACHMENT_PREVIEW_URL,
    { fetchPolicy: 'network-only' }
  );

  const loading = type === 'document' ? docLoading : attLoading;
  const error = (type === 'document' ? docError : attError) || null;

  /**
   * Open preview modal with a document
   */
  const openPreview = useCallback((document: PreviewableDocument) => {
    setSelectedDocument(document);
    setIsPreviewOpen(true);
  }, []);

  /**
   * Close preview modal
   */
  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    // Delay clearing document to allow modal close animation
    setTimeout(() => setSelectedDocument(null), 200);
  }, []);

  /**
   * Fetch preview URL for a document
   */
  const fetchPreviewUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      try {
        if (type === 'document') {
          const result = await fetchDocumentPreview({
            variables: { documentId },
          });
          const rawData = result.data as { documentPreviewUrl?: PreviewUrlResult } | undefined;
          return rawData?.documentPreviewUrl?.url || null;
        } else {
          const result = await fetchAttachmentPreview({
            variables: { attachmentId: documentId },
          });
          const rawData = result.data as { attachmentPreviewUrl?: PreviewUrlResult } | undefined;
          return rawData?.attachmentPreviewUrl?.url || null;
        }
      } catch (err) {
        console.error('Failed to fetch preview URL:', err);
        return null;
      }
    },
    [type, fetchDocumentPreview, fetchAttachmentPreview]
  );

  return {
    selectedDocument,
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    loading,
    error,
  };
}

export default useDocumentPreview;
