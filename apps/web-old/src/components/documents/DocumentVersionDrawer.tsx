/**
 * DocumentVersionDrawer Component
 * OPS-176: Document Version History Drawer
 *
 * Displays document version history in a slide-out drawer panel.
 * Shows timeline with version entries, each showing version number,
 * date, author, and optional changes summary.
 */

'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Clock, User, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { useDocumentVersions, type DocumentVersion } from '../../hooks/useDocumentVersions';

// ============================================================================
// Types
// ============================================================================

interface DocumentVersionDrawerProps {
  /** Document ID to fetch versions for */
  documentId: string | null;
  /** Document name for display in header */
  documentName: string;
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Optional: Handler for downloading a specific version */
  onDownloadVersion?: (versionId: string, versionNumber: number) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Sub-components
// ============================================================================

function VersionsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative pl-10">
          <div className="absolute left-2.5 w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
          <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionEntry({
  version,
  isCurrent,
  onDownload,
}: {
  version: DocumentVersion;
  isCurrent: boolean;
  onDownload?: () => void;
}) {
  const authorName = `${version.createdBy.firstName} ${version.createdBy.lastName}`;

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div
        className={clsx(
          'absolute left-2.5 w-3 h-3 rounded-full border-2 -translate-x-1/2',
          isCurrent ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
        )}
      />

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className={clsx(
          'p-3 rounded-lg border transition-colors',
          isCurrent
            ? 'bg-blue-50 border-blue-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">
            Versiunea {version.versionNumber}
            {isCurrent && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Curentă
              </span>
            )}
          </span>
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
              title="Descarcă această versiune"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span>
              {formatDistanceToNow(new Date(version.createdAt), {
                addSuffix: true,
                locale: ro,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <span>{authorName}</span>
          </div>
          {version.fileSize && (
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              <span>{formatFileSize(version.fileSize)}</span>
            </div>
          )}
          {version.changesSummary && (
            <p className="text-gray-500 italic mt-2 pl-5">&ldquo;{version.changesSummary}&rdquo;</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EmptyVersions() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">Nu există istoric de versiuni</p>
      <p className="text-xs text-gray-400 mt-1">Versiunile apar când documentul este modificat</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentVersionDrawer({
  documentId,
  documentName,
  isOpen,
  onClose,
  onDownloadVersion,
}: DocumentVersionDrawerProps) {
  const { versions, loading, error } = useDocumentVersions(isOpen ? documentId : null);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={handleBackdropClick}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white shadow-xl z-50 border-l border-gray-200 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900">Istoric versiuni</h2>
                <p className="text-sm text-gray-500 truncate" title={documentName}>
                  {documentName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors ml-2"
                title="Închide"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Version Timeline */}
            <div className="flex-1 p-4 overflow-y-auto">
              {loading ? (
                <VersionsSkeleton />
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500">Eroare la încărcarea versiunilor</p>
                  <p className="text-xs text-gray-400 mt-1">{error.message}</p>
                </div>
              ) : versions.length === 0 ? (
                <EmptyVersions />
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                  {/* Version entries */}
                  <div className="space-y-4">
                    {versions.map((version, index) => (
                      <VersionEntry
                        key={version.id}
                        version={version}
                        isCurrent={index === 0}
                        onDownload={
                          onDownloadVersion
                            ? () => onDownloadVersion(version.id, version.versionNumber)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with version count */}
            {versions.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
                {versions.length} {versions.length === 1 ? 'versiune' : 'versiuni'} în total
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

DocumentVersionDrawer.displayName = 'DocumentVersionDrawer';
