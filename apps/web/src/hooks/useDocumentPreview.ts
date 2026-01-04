/**
 * useDocumentPreview Hook
 * Manages document preview modal state and preview URL fetching
 * Uses SharePoint/OneDrive for document previews via Microsoft Graph API
 */

import { useState, useCallback } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client/react';
import { GET_DOCUMENT_PREVIEW_URL, GET_DOCUMENT_TEXT_CONTENT } from '@/graphql/queries';
import { GET_DOCUMENT_DOWNLOAD_URL, OPEN_IN_WORD } from '@/graphql/mutations';

// ============================================================================
// Types
// ============================================================================

// File type constants for preview method detection
const OFFICE_TYPES = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt'];
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const TEXT_TYPES = ['txt', 'json', 'csv', 'html', 'css', 'js', 'ts', 'md'];

export type PreviewMethod = 'pdf' | 'image' | 'office' | 'text' | 'unsupported';
export type PreviewPhase = 'thumbnail' | 'largeThumbnail' | 'fullPreview';

export interface PreviewState {
  phase: PreviewPhase;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewMethod: PreviewMethod;
  isLoading: boolean;
  error: Error | null;
}

// Sync result from SharePoint auto-sync
interface SyncResult {
  synced: boolean;
  newVersionNumber?: number;
}

// Preview URL result from backend
interface PreviewUrlResult {
  url: string;
  source: string;
  expiresAt?: string;
  syncResult?: SyncResult;
}

// Download URL result (mutation response)
interface DownloadUrlResult {
  url: string;
  expirationDateTime: string;
}

// Word edit session result
interface WordEditSessionResult {
  documentId: string;
  wordUrl: string;
  webUrl?: string | null;
  lockToken: string;
  expiresAt: string;
  oneDriveId: string;
}

// Callback for version updates (e.g., to refresh version badge)
type OnVersionSyncedCallback = (documentId: string, newVersionNumber: number) => void;

export interface UseDocumentPreviewOptions {
  /** Callback when a new version is synced from SharePoint */
  onVersionSynced?: OnVersionSyncedCallback;
}

export interface UseDocumentPreviewReturn {
  // State
  isPreviewOpen: boolean;
  previewDocumentId: string | null;
  previewUrl: string | null;
  previewMethod: PreviewMethod;
  isLoading: boolean;
  error: Error | null;
  textContent: string | null;
  lastSyncResult: SyncResult | null;

  // Actions
  openPreview: (documentId: string, fileType: string) => void;
  closePreview: () => void;
  fetchPreviewUrl: (documentId: string) => Promise<string | null>;
  fetchDownloadUrl: (documentId: string) => Promise<string | null>;
  fetchTextContent: (documentId: string) => Promise<string | null>;
  openInWord: (documentId: string) => Promise<{ wordUrl: string; webUrl?: string | null } | null>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine preview method based on file type
 */
export function getPreviewMethod(fileType: string): PreviewMethod {
  const type = fileType.toLowerCase();
  if (type === 'pdf') return 'pdf';
  if (IMAGE_TYPES.includes(type)) return 'image';
  if (OFFICE_TYPES.includes(type)) return 'office';
  if (TEXT_TYPES.includes(type)) return 'text';
  return 'unsupported';
}

// ============================================================================
// Hook
// ============================================================================

export function useDocumentPreview(
  options: UseDocumentPreviewOptions = {}
): UseDocumentPreviewReturn {
  const { onVersionSynced } = options;

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMethod, setPreviewMethod] = useState<PreviewMethod>('unsupported');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // GraphQL queries
  const [fetchDocumentPreview] = useLazyQuery(GET_DOCUMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only',
  });

  const [fetchTextContentQuery] = useLazyQuery(GET_DOCUMENT_TEXT_CONTENT, {
    fetchPolicy: 'network-only',
  });

  // GraphQL mutations
  const [getDownloadUrlMutation] = useMutation(GET_DOCUMENT_DOWNLOAD_URL);
  const [openInWordMutation] = useMutation(OPEN_IN_WORD);

  /**
   * Open preview modal for a document
   */
  const openPreview = useCallback((documentId: string, fileType: string) => {
    setPreviewDocumentId(documentId);
    setPreviewMethod(getPreviewMethod(fileType));
    setIsPreviewOpen(true);
    setError(null);
    setPreviewUrl(null);
    setTextContent(null);
  }, []);

  /**
   * Close preview modal
   */
  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    // Delay clearing state to allow modal close animation
    setTimeout(() => {
      setPreviewDocumentId(null);
      setPreviewUrl(null);
      setPreviewMethod('unsupported');
      setError(null);
      setTextContent(null);
    }, 200);
  }, []);

  /**
   * Fetch preview URL (for Office documents via Office Online)
   * Also handles sync results from SharePoint auto-sync
   */
  const fetchPreviewUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchDocumentPreview({
          variables: { documentId },
        });
        const rawData = result.data as { documentPreviewUrl?: PreviewUrlResult } | undefined;
        const previewData = rawData?.documentPreviewUrl;

        // Handle sync result from SharePoint auto-sync
        if (previewData?.syncResult?.synced && previewData.syncResult.newVersionNumber) {
          const syncData: SyncResult = {
            synced: true,
            newVersionNumber: previewData.syncResult.newVersionNumber,
          };
          setLastSyncResult(syncData);

          // Call callback for version badge update
          if (onVersionSynced) {
            onVersionSynced(documentId, previewData.syncResult.newVersionNumber);
          }
        } else {
          setLastSyncResult(null);
        }

        const url = previewData?.url || null;
        setPreviewUrl(url);
        return url;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch preview URL');
        setError(error);
        console.error('Failed to fetch preview URL:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDocumentPreview, onVersionSynced]
  );

  /**
   * Fetch download URL (for PDFs with react-pdf)
   * Uses mutation since it generates a time-limited pre-signed URL
   */
  const fetchDownloadUrl = useCallback(
    async (documentId: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getDownloadUrlMutation({
          variables: { documentId },
        });
        const rawData = result.data as { getDocumentDownloadUrl?: DownloadUrlResult } | undefined;
        const url = rawData?.getDocumentDownloadUrl?.url || null;
        setPreviewUrl(url);
        return url;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch download URL');
        setError(error);
        console.error('Failed to fetch download URL:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getDownloadUrlMutation]
  );

  /**
   * Fetch text content (for text files)
   */
  const fetchTextContent = useCallback(
    async (documentId: string): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchTextContentQuery({
          variables: { documentId },
        });
        const rawData = result.data as { documentTextContent?: string } | undefined;
        const content = rawData?.documentTextContent || null;
        setTextContent(content);
        return content;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch text content');
        setError(error);
        console.error('Failed to fetch text content:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTextContentQuery]
  );

  /**
   * Open document in Word desktop app
   * Returns both wordUrl (for desktop Word) and webUrl (for Word Online fallback)
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
    isPreviewOpen,
    previewDocumentId,
    previewUrl,
    previewMethod,
    isLoading,
    error,
    textContent,
    lastSyncResult,
    openPreview,
    closePreview,
    fetchPreviewUrl,
    fetchDownloadUrl,
    fetchTextContent,
    openInWord,
  };
}

export default useDocumentPreview;
