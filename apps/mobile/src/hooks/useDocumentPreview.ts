'use client';

import { useState, useCallback } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { GET_DOCUMENT_PREVIEW_URL } from '@/graphql/queries';

// ============================================
// Types
// ============================================

interface PreviewUrlResponse {
  url: string;
  source: 'pdf' | 'office365' | 'image';
  expiresAt: string;
}

interface DocumentPreviewState {
  documentId: string | null;
  fileName: string | null;
  fileType: string | null;
  thumbnailUrl: string | null;
}

// ============================================
// Hook
// ============================================

export function useDocumentPreview() {
  const [isOpen, setIsOpen] = useState(false);
  const [previewState, setPreviewState] = useState<DocumentPreviewState>({
    documentId: null,
    fileName: null,
    fileType: null,
    thumbnailUrl: null,
  });

  const [fetchPreviewUrl, { data, loading, error }] = useLazyQuery<{
    documentPreviewUrl: PreviewUrlResponse | null;
  }>(GET_DOCUMENT_PREVIEW_URL, {
    fetchPolicy: 'network-only', // Always fetch fresh URL (they expire)
  });

  const openPreview = useCallback(
    (doc: { id: string; fileName: string; fileType: string; thumbnailMedium?: string | null }) => {
      setPreviewState({
        documentId: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        thumbnailUrl: doc.thumbnailMedium || null,
      });
      setIsOpen(true);
      fetchPreviewUrl({ variables: { documentId: doc.id } });
    },
    [fetchPreviewUrl]
  );

  const closePreview = useCallback(() => {
    setIsOpen(false);
    // Clear state after animation
    setTimeout(() => {
      setPreviewState({
        documentId: null,
        fileName: null,
        fileType: null,
        thumbnailUrl: null,
      });
    }, 300);
  }, []);

  const previewUrl = data?.documentPreviewUrl?.url || null;
  const previewSource = data?.documentPreviewUrl?.source || null;

  // Determine if the file type supports inline preview
  const supportsPreview = useCallback((fileType: string | null): boolean => {
    if (!fileType) return false;
    const previewableTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    return previewableTypes.includes(fileType);
  }, []);

  return {
    isOpen,
    openPreview,
    closePreview,
    previewUrl,
    previewSource,
    loading,
    error,
    documentId: previewState.documentId,
    fileName: previewState.fileName,
    fileType: previewState.fileType,
    thumbnailUrl: previewState.thumbnailUrl,
    supportsPreview,
  };
}
