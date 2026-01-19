/**
 * SaveToPlatformButton Component
 * Saves the current Word document to the platform case folder (SharePoint).
 *
 * Flow:
 * 1. Gets document as base64 via Office.js
 * 2. Uploads to SharePoint via gateway API
 * 3. Creates Document record linked to case
 * 4. Handles versioning if document already exists
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import { getDocumentAsBase64 } from '../services/word-api';

// ============================================================================
// Types
// ============================================================================

interface SaveToPlatformButtonProps {
  caseId: string;
  caseNumber: string;
  documentId?: string; // For existing documents (edit mode)
  documentName: string;
  generationMetadata?: {
    tokensUsed: number;
    processingTimeMs: number;
  };
  onSuccess?: (result: { documentId: string; isNewVersion: boolean; caseNumber?: string }) => void;
  onError?: (error: string) => void;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// ============================================================================
// Component
// ============================================================================

export function SaveToPlatformButton({
  caseId,
  caseNumber,
  documentId: existingDocumentId,
  documentName,
  generationMetadata,
  onSuccess,
  onError,
}: SaveToPlatformButtonProps) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [savedInfo, setSavedInfo] = useState<{ isNewVersion: boolean } | null>(null);

  const handleSave = useCallback(async () => {
    if (status === 'saving') return;

    setStatus('saving');
    setErrorMessage('');
    setSavedInfo(null);

    try {
      // 1. Get document content as base64
      console.log('[SaveToPlatform] Getting document as base64...');
      const fileContent = await getDocumentAsBase64();
      console.log('[SaveToPlatform] Document size:', Math.round(fileContent.length / 1024), 'KB');

      // 2. Upload to platform
      console.log('[SaveToPlatform] Uploading to platform...', {
        caseId,
        documentName,
        existingDocumentId,
      });
      const result = await apiClient.saveToPlatform({
        caseId,
        fileName: documentName,
        fileContent,
        documentId: existingDocumentId,
        generationMetadata,
      });

      console.log('[SaveToPlatform] Save successful:', result);

      setSavedInfo({ isNewVersion: result.isNewVersion });
      setStatus('success');
      onSuccess?.({
        documentId: result.documentId,
        isNewVersion: result.isNewVersion,
        caseNumber: result.caseNumber || caseNumber,
      });
    } catch (err) {
      console.error('[SaveToPlatform] Save error:', err);
      const msg = (err as Error)?.message || 'Nu s-a putut salva documentul';
      setStatus('error');
      setErrorMessage(msg);
      onError?.(msg);
    }
  }, [
    status,
    caseId,
    caseNumber,
    existingDocumentId,
    documentName,
    generationMetadata,
    onSuccess,
    onError,
  ]);

  return (
    <div className="save-to-platform">
      <button
        className={`btn btn-save ${status === 'saving' ? 'saving' : ''} ${status === 'success' ? 'success' : ''} ${status === 'error' ? 'error' : ''}`}
        onClick={handleSave}
        disabled={status === 'saving' || status === 'success'}
      >
        {status === 'saving' ? (
          <>
            <span className="loading-spinner" style={{ width: 16, height: 16, margin: 0 }}></span>
            Se salvează...
          </>
        ) : status === 'success' ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Salvat în platformă
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Salvează în platformă
          </>
        )}
      </button>

      {status === 'error' && errorMessage && (
        <div className="save-error">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMessage}
        </div>
      )}

      {status === 'success' && savedInfo && (
        <div className="save-success">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {savedInfo.isNewVersion ? 'Versiune nouă salvată' : 'Document salvat în dosar'}
        </div>
      )}
    </div>
  );
}
