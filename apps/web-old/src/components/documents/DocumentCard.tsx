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
  /** Handler for preview action - OPS-163: Card click triggers preview */
  onPreview: () => void;
  /** Handler for add to mapa action */
  onAddToMapa?: () => void;
  /** Handler for open in Word action (DOCX files only) */
  onOpenInWord?: () => void;
  /** OPS-176: Handler for viewing version history (only called if versionCount > 1) */
  onViewVersions?: () => void;
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

/**
 * OPS-163: Check if file is a Word document
 */
function isWordDocument(fileType: string): boolean {
  const type = fileType.toLowerCase();
  return (
    type.includes('doc') ||
    type.includes('word') ||
    type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')
  );
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
 * OPS-163: Click anywhere on card opens preview, file-type specific actions
 */
export function DocumentCard({
  document: docContext,
  onPreview,
  onAddToMapa,
  onOpenInWord,
  onViewVersions,
  className,
}: DocumentCardProps) {
  const { document, isOriginal, sourceCase } = docContext;
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);

  const thumbnailUrl =
    document.thumbnailLarge || document.thumbnailMedium || document.thumbnailSmall;
  const uploaderName = `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`;
  const isWord = isWordDocument(document.fileType);
  const hasMultipleVersions = (document.versionCount ?? 0) > 1;

  return (
    <div
      onClick={onPreview}
      className={clsx(
        'bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer',
        'hover:shadow-lg hover:border-gray-300 transition-all duration-200',
        'group',
        className
      )}
    >
      {/* Thumbnail Area - 4:3 aspect ratio when image available, compact when not */}
      <div
        className={clsx(
          'bg-gray-50 relative overflow-hidden',
          thumbnailUrl && !imageError ? 'aspect-[4/3]' : 'h-20'
        )}
      >
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
            <FileTypeIcon fileType={document.fileType} className="!w-10 !h-10" />
          </div>
        )}

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

        {/* Storage indicator and version badge */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {document.storageType && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-600 shadow-sm">
              {document.storageType === 'SHAREPOINT' && (
                <svg className="w-3 h-3 mr-1 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2.1c-.9-.1-1.8.1-2.6.6L3.5 6.4c-1.5.9-2.1 2.8-1.4 4.4l.1.2c.5 1.1 1.5 1.9 2.7 2.1l7.6 1.3c.9.2 1.5.9 1.5 1.8v.1c0 1-.8 1.8-1.8 1.8H5.1c-.6 0-1.1.5-1.1 1.1s.5 1.1 1.1 1.1h7.1c2.2 0 4-1.8 4-4v-.1c0-1.9-1.3-3.5-3.2-3.8L5.4 11c-.5-.1-.9-.4-1.1-.8l-.1-.2c-.3-.6-.1-1.4.5-1.8l6.4-3.7c.3-.2.7-.3 1-.2.4.1.7.3.9.7l.9 1.5c.3.5.9.7 1.4.4.5-.3.7-.9.4-1.4l-.9-1.5c-.5-.9-1.3-1.6-2.3-1.9z" />
                </svg>
              )}
              {getStorageLabel(document.storageType)}
            </span>
          )}
          {/* OPS-176: Version badge - only show for documents with multiple versions */}
          {hasMultipleVersions && onViewVersions && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewVersions();
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-600 shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Vezi istoricul versiunilor"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              v{document.versionCount}
            </button>
          )}
        </div>
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

        {/* OPS-163: File-type specific actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          {onAddToMapa && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToMapa();
              }}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-purple-50 hover:text-purple-600 transition-colors"
              title="Adaugă în mapă"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Mapă
            </button>
          )}
          {isWord && onOpenInWord && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenInWord();
              }}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Deschide în Word"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Word
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

DocumentCard.displayName = 'DocumentCard';
