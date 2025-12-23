/**
 * DocumentCard Component
 * OPS-111: Document Grid UI with Thumbnails
 *
 * Displays a document as a card with large first-page thumbnail,
 * metadata, and action buttons for preview/download.
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { clsx } from 'clsx';
import type {
  DocumentGridItem,
  DocumentStatus,
  DocumentStorageType,
} from '../../hooks/useDocumentGrid';

// ============================================================================
// Types
// ============================================================================

export interface DocumentCardProps {
  /** Document with context from grid query */
  document: DocumentGridItem;
  /** Handler for preview action */
  onPreview: () => void;
  /** Handler for download action */
  onDownload: () => void;
  /** Handler for add to mapa action */
  onAddToMapa?: () => void;
  /** Whether download is in progress */
  isDownloading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

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
 * Get file icon color based on file type
 */
function getFileIconColor(fileType: string): string {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return 'text-red-500';
  if (type.includes('doc') || type.includes('word')) return 'text-blue-600';
  if (type.includes('xls') || type.includes('excel')) return 'text-green-600';
  if (type.includes('ppt') || type.includes('powerpoint')) return 'text-orange-500';
  if (
    type.includes('image') ||
    type.includes('png') ||
    type.includes('jpg') ||
    type.includes('jpeg')
  )
    return 'text-purple-500';
  return 'text-gray-500';
}

/**
 * Get status badge styles
 */
function getStatusStyles(status: DocumentStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800';
    case 'PENDING':
      return 'bg-blue-100 text-blue-800';
    case 'FINAL':
      return 'bg-green-100 text-green-800';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get storage type label
 */
function getStorageLabel(storageType: DocumentStorageType): string {
  switch (storageType) {
    case 'SHAREPOINT':
      return 'SharePoint';
    case 'ONEDRIVE':
      return 'OneDrive';
    case 'R2':
      return 'Cloud';
    default:
      return '';
  }
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * File type icon (used when no thumbnail available)
 */
function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  return (
    <svg
      className={clsx('w-16 h-16', getFileIconColor(fileType), className)}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Thumbnail loading skeleton
 */
function ThumbnailSkeleton() {
  return (
    <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
      <div className="w-16 h-16 bg-gray-200 rounded" />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * DocumentCard - Displays document as card with thumbnail
 */
export function DocumentCard({
  document: docContext,
  onPreview,
  onDownload,
  onAddToMapa,
  isDownloading = false,
  className,
}: DocumentCardProps) {
  const { document, isOriginal, sourceCase } = docContext;
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  const thumbnailUrl =
    document.thumbnailLarge || document.thumbnailMedium || document.thumbnailSmall;
  const uploaderName = `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`;

  return (
    <div
      className={clsx(
        'bg-white border border-gray-200 rounded-lg overflow-hidden',
        'hover:shadow-lg hover:border-gray-300 transition-all duration-200',
        'group',
        className
      )}
    >
      {/* Thumbnail Area - 4:3 aspect ratio */}
      <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
        {thumbnailUrl && !imageError ? (
          <>
            {imageLoading && <ThumbnailSkeleton />}
            <img
              src={thumbnailUrl}
              alt={document.fileName}
              className={clsx(
                'w-full h-full object-contain transition-opacity duration-200',
                imageLoading ? 'opacity-0' : 'opacity-100'
              )}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <FileTypeIcon fileType={document.fileType} />
          </div>
        )}

        {/* Overlay actions on hover */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/50 flex items-center justify-center gap-3',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
        >
          <button
            onClick={onPreview}
            className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            title="Previzualizare"
          >
            <svg
              className="w-5 h-5 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className={clsx(
              'p-3 bg-white rounded-full shadow-lg transition-colors',
              isDownloading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
            )}
            title="Descarcă"
          >
            {isDownloading ? (
              <svg className="w-5 h-5 text-gray-700 animate-spin" fill="none" viewBox="0 0 24 24">
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
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {!isOriginal && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Importat
            </span>
          )}
          <span
            className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              getStatusStyles(document.status)
            )}
          >
            {document.status}
          </span>
        </div>

        {/* Storage indicator */}
        {document.storageType && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-600 shadow-sm">
              {document.storageType === 'SHAREPOINT' && (
                <svg className="w-3 h-3 mr-1 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2.1c-.9-.1-1.8.1-2.6.6L3.5 6.4c-1.5.9-2.1 2.8-1.4 4.4l.1.2c.5 1.1 1.5 1.9 2.7 2.1l7.6 1.3c.9.2 1.5.9 1.5 1.8v.1c0 1-.8 1.8-1.8 1.8H5.1c-.6 0-1.1.5-1.1 1.1s.5 1.1 1.1 1.1h7.1c2.2 0 4-1.8 4-4v-.1c0-1.9-1.3-3.5-3.2-3.8L5.4 11c-.5-.1-.9-.4-1.1-.8l-.1-.2c-.3-.6-.1-1.4.5-1.8l6.4-3.7c.3-.2.7-.3 1-.2.4.1.7.3.9.7l.9 1.5c.3.5.9.7 1.4.4.5-.3.7-.9.4-1.4l-.9-1.5c-.5-.9-1.3-1.6-2.3-1.9z" />
                </svg>
              )}
              {getStorageLabel(document.storageType)}
            </span>
          </div>
        )}
      </div>

      {/* Document Info */}
      <div className="p-4">
        {/* File name */}
        <h3 className="font-medium text-gray-900 truncate" title={document.fileName}>
          {document.fileName}
        </h3>

        {/* Metadata line */}
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
          <span>{formatFileSize(document.fileSize)}</span>
          <span className="text-gray-300">•</span>
          <span className="truncate">{uploaderName}</span>
        </p>

        {/* Date and source */}
        <p className="text-sm text-gray-400 mt-1">
          Încărcat: {format(new Date(document.uploadedAt), 'd MMM yyyy', { locale: ro })}
        </p>

        {/* Source case (if imported) */}
        {!isOriginal && sourceCase && (
          <p
            className="text-xs text-purple-600 mt-1 truncate"
            title={`${sourceCase.caseNumber} - ${sourceCase.title}`}
          >
            Din: {sourceCase.caseNumber}
          </p>
        )}

        {/* Actions - visible below card */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onPreview}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Previzualizare
          </button>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className={clsx(
              'flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg transition-colors',
              isDownloading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
            )}
          >
            {isDownloading ? (
              <>
                <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                Se descarcă...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Descarcă
              </>
            )}
          </button>
          {onAddToMapa && (
            <button
              onClick={onAddToMapa}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Adaugă în mapă"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

DocumentCard.displayName = 'DocumentCard';
