/**
 * useDocumentPreview Hook
 * Manages document preview modal state and preview URL fetching
 */

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import type { PreviewableDocument } from '@/components/preview';

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: UUID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
    }
  }
`;

const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: UUID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

// OPS-109: Query for text file content (proxied through backend to avoid CORS)
const GET_DOCUMENT_TEXT_CONTENT = gql`
  query GetDocumentTextContent($documentId: UUID!) {
    documentTextContent(documentId: $documentId) {
      content
      mimeType
      size
    }
  }
`;

// Mutation to get download URL for PDFs (OPS-125)
const GET_DOCUMENT_DOWNLOAD_URL = gql`
  mutation GetDocumentDownloadUrl($documentId: UUID!) {
    getDocumentDownloadUrl(documentId: $documentId) {
      url
      expirationDateTime
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

// OPS-109: Text content result from backend proxy
interface TextContentResult {
  content: string;
  mimeType: string;
  size: number;
}

// OPS-125: Download URL result for PDF preview
interface DownloadUrlResult {
  url: string;
  expirationDateTime: string;
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
  /** Fetch download URL for a document (OPS-125: for PDF preview) */
  fetchDownloadUrl: (documentId: string) => Promise<string | null>;
  /** Fetch text content for a text file (OPS-109) */
  fetchTextContent: (documentId: string) => Promise<string | null>;
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

  // OPS-109: Text content query for text files
  const [fetchTextContentQuery] = useLazyQuery(GET_DOCUMENT_TEXT_CONTENT, {
    fetchPolicy: 'network-only',
  });

  // OPS-125: Download URL mutation for PDF preview
  const [getDownloadUrlMutation] = useMutation(GET_DOCUMENT_DOWNLOAD_URL);

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

  /**
   * Fetch download URL for a document (OPS-125)
   * Used for PDF preview with react-pdf
   */
  const fetchDownloadUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      try {
        const result = await getDownloadUrlMutation({
          variables: { documentId },
        });
        const rawData = result.data as { getDocumentDownloadUrl?: DownloadUrlResult } | undefined;
        return rawData?.getDocumentDownloadUrl?.url || null;
      } catch (err) {
        console.error('Failed to fetch download URL:', err);
        return null;
      }
    },
    [getDownloadUrlMutation]
  );

  /**
   * Fetch text content for a text file (OPS-109)
   * Used for text/plain, text/csv, application/json, etc.
   */
  const fetchTextContent = useCallback(
    async (documentId: string): Promise<string | null> => {
      try {
        const result = await fetchTextContentQuery({
          variables: { documentId },
        });
        const rawData = result.data as { documentTextContent?: TextContentResult } | undefined;
        return rawData?.documentTextContent?.content || null;
      } catch (err) {
        console.error('Failed to fetch text content:', err);
        return null;
      }
    },
    [fetchTextContentQuery]
  );

  return {
    selectedDocument,
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
    loading,
    error,
  };
}

export default useDocumentPreview;
