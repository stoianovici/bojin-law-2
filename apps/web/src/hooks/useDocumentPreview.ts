/**
 * useDocumentPreview Hook
 * Manages document preview modal state and preview URL fetching
 * OPS-183: Added auto-sync integration with toast notifications
 */

import { useState, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import type { PreviewableDocument } from '@/components/preview';
import { useNotificationStore } from '@/stores/notificationStore';

// ============================================================================
// GraphQL Queries
// ============================================================================

// OPS-183: Added syncResult field for auto-sync integration
const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: UUID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
      syncResult {
        synced
        newVersionNumber
      }
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

// OPS-164: Mutation to open document in Word desktop app
const OPEN_IN_WORD = gql`
  mutation OpenInWord($documentId: UUID!) {
    openInWord(documentId: $documentId) {
      documentId
      wordUrl
      webUrl
      lockToken
      expiresAt
      oneDriveId
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

// OPS-183: Sync result from SharePoint auto-sync
interface SyncResult {
  synced: boolean;
  newVersionNumber?: number;
}

interface PreviewUrlResult {
  url: string;
  source: string;
  expiresAt?: string;
  syncResult?: SyncResult; // OPS-183: Included when document was synced
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

// OPS-164: Word edit session result
interface WordEditSessionResult {
  documentId: string;
  wordUrl: string;
  webUrl?: string | null;
  lockToken: string;
  expiresAt: string;
  oneDriveId: string;
}

// OPS-183: Callback for version updates (e.g., to refresh version badge)
type OnVersionSyncedCallback = (documentId: string, newVersionNumber: number) => void;

interface UseDocumentPreviewOptions {
  /** Type of preview: 'document' or 'attachment' */
  type?: 'document' | 'attachment';
  /** OPS-183: Callback when a new version is synced from SharePoint */
  onVersionSynced?: OnVersionSyncedCallback;
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
  /** OPS-164: Open document in Word (returns wordUrl for desktop, webUrl for online fallback) */
  openInWord: (documentId: string) => Promise<{ wordUrl: string; webUrl?: string | null } | null>;
  /** Loading state for preview URL fetch */
  loading: boolean;
  /** Error from preview URL fetch */
  error: Error | null;
  /** OPS-183: Last sync result from preview fetch */
  lastSyncResult: SyncResult | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentPreview(
  options: UseDocumentPreviewOptions = {}
): UseDocumentPreviewReturn {
  const { type = 'document', onVersionSynced } = options;

  const [selectedDocument, setSelectedDocument] = useState<PreviewableDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null); // OPS-183

  // OPS-183: Access notification store for sync toasts
  const addNotification = useNotificationStore((state) => state.addNotification);

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

  // OPS-164: Open in Word mutation
  const [openInWordMutation] = useMutation(OPEN_IN_WORD);

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
   * OPS-183: Also handles sync results and shows toast notifications
   */
  const fetchPreviewUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      try {
        if (type === 'document') {
          const result = await fetchDocumentPreview({
            variables: { documentId },
          });
          const rawData = result.data as { documentPreviewUrl?: PreviewUrlResult } | undefined;
          const previewData = rawData?.documentPreviewUrl;

          // OPS-183: Handle sync result from SharePoint auto-sync
          if (previewData?.syncResult?.synced && previewData.syncResult.newVersionNumber) {
            const syncData: SyncResult = {
              synced: true,
              newVersionNumber: previewData.syncResult.newVersionNumber,
            };
            setLastSyncResult(syncData);

            // Show toast notification (Romanian text)
            addNotification({
              type: 'success',
              title: 'Document sincronizat',
              message: `Versiunea ${previewData.syncResult.newVersionNumber} a fost sincronizată din Word`,
              duration: 4000,
            });

            // Call callback for version badge update
            if (onVersionSynced) {
              onVersionSynced(documentId, previewData.syncResult.newVersionNumber);
            }
          } else {
            setLastSyncResult(null);
          }

          return previewData?.url || null;
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
    [type, fetchDocumentPreview, fetchAttachmentPreview, addNotification, onVersionSynced]
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

  /**
   * OPS-164: Open document in Word desktop app
   * Returns both wordUrl (for desktop Word) and webUrl (for Word Online fallback).
   */
  const openInWord = useCallback(
    async (documentId: string): Promise<{ wordUrl: string; webUrl?: string | null } | null> => {
      try {
        const result = await openInWordMutation({
          variables: { documentId },
        });
        const rawData = result.data as { openInWord?: WordEditSessionResult } | undefined;
        const session = rawData?.openInWord;
        if (!session?.wordUrl) return null;
        return {
          wordUrl: session.wordUrl,
          webUrl: session.webUrl,
        };
      } catch (err) {
        console.error('Failed to open document in Word:', err);
        return null;
      }
    },
    [openInWordMutation]
  );

  return {
    selectedDocument,
    isPreviewOpen,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
    openInWord,
    loading,
    error,
    lastSyncResult, // OPS-183: Last sync result from preview fetch
  };
}

export default useDocumentPreview;
