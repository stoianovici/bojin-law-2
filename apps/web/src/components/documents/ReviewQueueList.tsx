'use client';

/**
 * Review Queue List Component
 * OPS-174: Supervisor Review Queue Tab
 *
 * Displays documents pending review grouped by case.
 * Shows document info, submitter, and submission date.
 * Provides preview and review action buttons.
 */

import React from 'react';
import {
  FileText,
  File,
  FileImage,
  FileSpreadsheet,
  Clock,
  User,
  FolderOpen,
  Eye,
  ClipboardCheck,
  Inbox,
} from 'lucide-react';
import {
  useDocumentsForReview,
  type DocumentForReview,
  type ReviewQueueByCase,
} from '../../hooks/useDocumentsForReview';

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return FileText;
  if (
    type.includes('image') ||
    type.includes('png') ||
    type.includes('jpg') ||
    type.includes('jpeg')
  )
    return FileImage;
  if (type.includes('sheet') || type.includes('xlsx') || type.includes('xls'))
    return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'acum câteva minute';
  if (diffHours < 24) return `acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
  if (diffDays === 1) return 'ieri';
  if (diffDays < 7) return `acum ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ReviewQueueItemProps {
  item: DocumentForReview;
  onPreview: (document: DocumentForReview) => void;
  onReview: (document: DocumentForReview) => void;
}

function ReviewQueueItem({ item, onPreview, onReview }: ReviewQueueItemProps) {
  const FileIcon = getFileIcon(item.document.fileType);
  const submitterName = `${item.submittedBy.firstName} ${item.submittedBy.lastName}`;

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Thumbnail or Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
          {item.document.thumbnailSmall || item.document.thumbnailMedium ? (
            <img
              src={item.document.thumbnailMedium || item.document.thumbnailSmall || ''}
              alt={item.document.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <FileIcon className="h-6 w-6 text-gray-400" />
          )}
        </div>

        {/* Document Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate" title={item.document.fileName}>
            {item.document.fileName}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {submitterName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeDate(item.submittedAt)}
            </span>
            <span>{formatFileSize(item.document.fileSize)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-4">
        <button
          onClick={() => onPreview(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Previzualizare"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Previzualizare</span>
        </button>
        <button
          onClick={() => onReview(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          title="Revizuiește"
        >
          <ClipboardCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Revizuiește</span>
        </button>
      </div>
    </div>
  );
}

interface ReviewQueueCaseGroupProps {
  group: ReviewQueueByCase;
  onPreview: (document: DocumentForReview) => void;
  onReview: (document: DocumentForReview) => void;
}

function ReviewQueueCaseGroup({ group, onPreview, onReview }: ReviewQueueCaseGroupProps) {
  return (
    <div className="space-y-3">
      {/* Case Header */}
      <div className="flex items-center gap-2 text-gray-700">
        <FolderOpen className="h-4 w-4 text-gray-400" />
        <h3 className="font-medium">{group.case.title}</h3>
        <span className="text-xs text-gray-400">•</span>
        <span className="text-sm text-gray-500">{group.case.client.name}</span>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {group.documents.length} {group.documents.length === 1 ? 'document' : 'documente'}
        </span>
      </div>

      {/* Documents List */}
      <div className="space-y-2 pl-6">
        {group.documents.map((item) => (
          <ReviewQueueItem key={item.id} item={item} onPreview={onPreview} onReview={onReview} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-green-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun document de revizuit</h3>
      <p className="text-sm text-gray-500 max-w-sm">
        Nu aveți documente în așteptare. Când un coleg trimite un document pentru aprobare, acesta
        va apărea aici.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      {[1, 2].map((groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          {/* Case Header Skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Document Items Skeleton */}
          <div className="space-y-2 pl-6">
            {[1, 2].map((itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200"
              >
                <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ReviewQueueListProps {
  onPreview: (document: DocumentForReview) => void;
  onReview: (document: DocumentForReview) => void;
}

export function ReviewQueueList({ onPreview, onReview }: ReviewQueueListProps) {
  const { documentsByCase, loading, error } = useDocumentsForReview();

  if (loading && documentsByCase.length === 0) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Eroare la încărcare</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Nu am putut încărca documentele pentru revizuire. Vă rugăm să încercați din nou.
        </p>
      </div>
    );
  }

  if (documentsByCase.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-8">
      {documentsByCase.map((group) => (
        <ReviewQueueCaseGroup
          key={group.case.id}
          group={group}
          onPreview={onPreview}
          onReview={onReview}
        />
      ))}
    </div>
  );
}

ReviewQueueList.displayName = 'ReviewQueueList';
