/**
 * CaseDocumentsList - Document list for case detail page with linking/unlinking actions
 * Story 2.8.4: Cross-Case Document Linking
 * Story 2.9: Document Storage with OneDrive Integration
 *
 * Features:
 * - Shows documents linked to the case
 * - Indicates imported vs original documents
 * - Unlink action for all users
 * - Permanent delete action for Partners only
 * - Import button to open DocumentBrowserModal
 * - Upload button for OneDrive uploads (Story 2.9)
 * - Download and sync actions (Story 2.9)
 * - Document status badges (Story 2.9)
 */

'use client';

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import {
  useCaseDocuments,
  type CaseDocumentWithContext,
  type DocumentStatus,
} from '../../hooks/useCaseDocuments';
import { useUnlinkDocument, useDeleteDocument } from '../../hooks/useDocumentActions';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import { DocumentBrowserModal } from './DocumentBrowserModal';
import { DocumentUploadModal } from './DocumentUploadModal';

export interface CaseDocumentsListProps {
  caseId: string;
  caseName: string;
  clientId: string;
  userRole: 'Partner' | 'Associate' | 'Paralegal';
  className?: string;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file icon based on file type
 */
function FileIcon({ fileType }: { fileType: string }) {
  const type = fileType.toLowerCase();

  if (type.includes('pdf')) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (type.includes('doc') || type.includes('word')) {
    return (
      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (type.includes('xls') || type.includes('excel')) {
    return (
      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Confirmation Modal
 */
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-white rounded-lg',
                confirmVariant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status badge colors (Story 2.9)
const STATUS_COLORS: Record<DocumentStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  FINAL: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

/**
 * Document Card Component
 * Story 2.9: Extended with OneDrive actions
 */
function DocumentCard({
  docContext,
  userRole,
  onUnlink,
  onDelete,
  onDownload,
  onSync,
  isDownloading,
  isSyncing,
}: {
  docContext: CaseDocumentWithContext;
  userRole: 'Partner' | 'Associate' | 'Paralegal';
  onUnlink: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onSync: () => void;
  isDownloading: boolean;
  isSyncing: boolean;
}) {
  const { document, linkedBy, linkedAt, isOriginal, sourceCase } = docContext;
  const uploaderName = `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`;
  const linkerName = `${linkedBy.firstName} ${linkedBy.lastName}`;
  const hasOneDrive = !!document.oneDriveId;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <FileIcon fileType={document.fileType} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 truncate">{document.fileName}</h4>
            {!isOriginal && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                Imported
              </span>
            )}
            {/* Story 2.9: Status badge */}
            <span
              className={clsx(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                STATUS_COLORS[document.status]
              )}
            >
              {document.status}
            </span>
            {/* Story 2.9: OneDrive indicator */}
            {hasOneDrive && (
              <span className="inline-flex items-center text-blue-600" title="Stored in OneDrive">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>{formatFileSize(document.fileSize)}</span>
            <span>Uploaded by {uploaderName}</span>
            <span>{format(new Date(document.uploadedAt), 'dd MMM yyyy')}</span>
            {/* Story 2.9: Version info */}
            {document.versions && document.versions.length > 0 && (
              <span className="text-blue-600">v{document.versions[0].versionNumber}</span>
            )}
          </div>

          {!isOriginal && sourceCase && (
            <p className="mt-1 text-xs text-gray-500">
              From: {sourceCase.caseNumber} - {sourceCase.title}
            </p>
          )}

          {!isOriginal && (
            <p className="mt-1 text-xs text-gray-400">
              Linked by {linkerName} on {format(new Date(linkedAt), 'dd MMM yyyy')}
            </p>
          )}
        </div>

        {/* Actions - Story 2.9: Added download and sync */}
        <div className="flex items-center gap-2">
          {/* Download button */}
          {hasOneDrive && (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              title="Download from OneDrive"
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDownloading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              )}
            </button>
          )}

          {/* Sync button */}
          {hasOneDrive && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              title="Sync from OneDrive"
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          )}

          <button
            onClick={onUnlink}
            title="Unlink from case"
            className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </button>

          {userRole === 'Partner' && (
            <button
              onClick={onDelete}
              title="Permanently delete"
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CaseDocumentsList Component
 * Story 2.9: Extended with OneDrive upload and sync
 */
export function CaseDocumentsList({
  caseId,
  caseName,
  clientId,
  userRole,
  className,
}: CaseDocumentsListProps) {
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false); // Story 2.9
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ docId: string; docName: string } | null>(
    null
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{ docId: string; docName: string } | null>(
    null
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null); // Story 2.9
  const [syncingId, setSyncingId] = useState<string | null>(null); // Story 2.9

  // Fetch case documents
  const { documents, loading, error, refetch } = useCaseDocuments(caseId);

  // Mutations
  const { unlinkDocument, loading: unlinking } = useUnlinkDocument();
  const { deleteDocument, loading: deleting } = useDeleteDocument();

  // Story 2.9: OneDrive hooks
  const { getDownloadUrl, syncDocument } = useDocumentUpload();

  // Handle unlink
  const handleUnlink = useCallback(async () => {
    if (!unlinkConfirm) return;

    try {
      await unlinkDocument(caseId, unlinkConfirm.docId);
      setUnlinkConfirm(null);
    } catch (err) {
      console.error('Failed to unlink document:', err);
    }
  }, [caseId, unlinkConfirm, unlinkDocument]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      await deleteDocument(deleteConfirm.docId);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  }, [deleteConfirm, deleteDocument]);

  // Story 2.9: Handle download
  const handleDownload = useCallback(
    async (docId: string) => {
      setDownloadingId(docId);
      try {
        const result = await getDownloadUrl(docId);
        if (result?.url) {
          window.open(result.url, '_blank');
        }
      } catch (err) {
        console.error('Failed to get download URL:', err);
      } finally {
        setDownloadingId(null);
      }
    },
    [getDownloadUrl]
  );

  // Story 2.9: Handle sync
  const handleSync = useCallback(
    async (docId: string) => {
      setSyncingId(docId);
      try {
        const result = await syncDocument(docId);
        if (result?.updated) {
          refetch();
        }
      } catch (err) {
        console.error('Failed to sync document:', err);
      } finally {
        setSyncingId(null);
      }
    },
    [syncDocument, refetch]
  );

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200', className)}>
      {/* Header - Story 2.9: Added upload button */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
          <p className="text-sm text-gray-500">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} linked to this
            case
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Story 2.9: Upload button */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Upload to OneDrive
          </button>
          <button
            onClick={() => setIsBrowserOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Import Documents
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-600">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="font-medium">Failed to load documents</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <svg
              className="w-16 h-16 mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="font-medium mb-1">No documents yet</p>
            <p className="text-sm mb-4">Import documents from other cases or upload new ones</p>
            <button
              onClick={() => setIsBrowserOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import Documents
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((docContext) => (
              <DocumentCard
                key={docContext.document.id}
                docContext={docContext}
                userRole={userRole}
                onUnlink={() =>
                  setUnlinkConfirm({
                    docId: docContext.document.id,
                    docName: docContext.document.fileName,
                  })
                }
                onDelete={() =>
                  setDeleteConfirm({
                    docId: docContext.document.id,
                    docName: docContext.document.fileName,
                  })
                }
                onDownload={() => handleDownload(docContext.document.id)}
                onSync={() => handleSync(docContext.document.id)}
                isDownloading={downloadingId === docContext.document.id}
                isSyncing={syncingId === docContext.document.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <DocumentBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        clientId={clientId}
        caseId={caseId}
        caseName={caseName}
        onImportComplete={refetch}
      />

      {/* Story 2.9: Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        caseId={caseId}
        caseName={caseName}
        onUploadComplete={refetch}
      />

      {/* Unlink Confirmation */}
      <ConfirmModal
        isOpen={!!unlinkConfirm}
        title="Unlink Document"
        message={`Are you sure you want to unlink "${unlinkConfirm?.docName}" from this case? The document will remain available in other cases where it's linked.`}
        confirmLabel="Unlink"
        confirmVariant="warning"
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkConfirm(null)}
        isLoading={unlinking}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Permanently Delete Document"
        message={`Are you sure you want to permanently delete "${deleteConfirm?.docName}"? This will remove it from ALL cases and cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        isLoading={deleting}
      />
    </div>
  );
}

CaseDocumentsList.displayName = 'CaseDocumentsList';
