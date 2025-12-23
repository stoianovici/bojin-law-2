/**
 * DocumentGrid Component
 * OPS-111: Document Grid UI with Thumbnails
 *
 * Grid container for displaying documents as cards with thumbnails.
 * Supports 2 columns on desktop, 1 on mobile, with load more pagination.
 */

'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { DocumentCard } from './DocumentCard';
import type {
  DocumentGridItem,
  DocumentSortField,
  SortDirection,
} from '../../hooks/useDocumentGrid';

// ============================================================================
// Types
// ============================================================================

export interface DocumentGridProps {
  /** Documents to display */
  documents: DocumentGridItem[];
  /** Whether data is loading */
  loading: boolean;
  /** Total count of documents */
  totalCount: number;
  /** Whether more documents can be loaded */
  hasMore: boolean;
  /** Handler to load more documents */
  onLoadMore: () => void;
  /** Handler for document preview */
  onPreview: (doc: DocumentGridItem) => void;
  /** Handler for document download */
  onDownload: (doc: DocumentGridItem) => void;
  /** Handler for add to mapa */
  onAddToMapa?: (doc: DocumentGridItem) => void;
  /** Currently downloading document ID */
  downloadingId?: string | null;
  /** Current sort field */
  sortBy?: DocumentSortField;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Handler for sort change */
  onSortChange?: (field: DocumentSortField, direction: SortDirection) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Loading skeleton for grid items
 */
function DocumentCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-[4/3] bg-gray-100" />
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
          <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no documents
 */
function EmptyState({ message }: { message?: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500">
      <svg
        className="w-20 h-20 mb-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="font-medium text-lg mb-1">Niciun document</p>
      <p className="text-sm text-gray-400">
        {message || 'Încărcați documente pentru a le vedea aici'}
      </p>
    </div>
  );
}

/**
 * Sort dropdown component
 */
function SortDropdown({
  sortBy,
  sortDirection,
  onSortChange,
}: {
  sortBy: DocumentSortField;
  sortDirection: SortDirection;
  onSortChange: (field: DocumentSortField, direction: SortDirection) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { field: DocumentSortField; label: string }[] = [
    { field: 'LINKED_AT', label: 'Data adăugării' },
    { field: 'UPLOADED_AT', label: 'Data încărcării' },
    { field: 'FILE_NAME', label: 'Nume fișier' },
    { field: 'FILE_SIZE', label: 'Dimensiune' },
    { field: 'FILE_TYPE', label: 'Tip fișier' },
  ];

  const currentLabel = sortOptions.find((o) => o.field === sortBy)?.label || 'Sortare';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
          />
        </svg>
        {currentLabel}
        <svg
          className="w-4 h-4 ml-2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="py-1">
            {sortOptions.map((option) => (
              <button
                key={option.field}
                onClick={() => {
                  // Toggle direction if same field, otherwise use DESC
                  const newDirection =
                    option.field === sortBy ? (sortDirection === 'DESC' ? 'ASC' : 'DESC') : 'DESC';
                  onSortChange(option.field, newDirection);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full px-4 py-2 text-sm text-left flex items-center justify-between',
                  option.field === sortBy
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{option.label}</span>
                {option.field === sortBy && (
                  <svg
                    className={clsx('w-4 h-4', sortDirection === 'ASC' && 'rotate-180')}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * DocumentGrid - Grid container for document cards
 */
export function DocumentGrid({
  documents,
  loading,
  totalCount,
  hasMore,
  onLoadMore,
  onPreview,
  onDownload,
  onAddToMapa,
  downloadingId,
  sortBy = 'LINKED_AT',
  sortDirection = 'DESC',
  onSortChange,
  className,
}: DocumentGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection]);

  const showEmptyState = !loading && documents.length === 0;
  const showSkeletons = loading && documents.length === 0;

  return (
    <div className={className}>
      {/* Header with count and sort */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {totalCount > 0 ? (
            <>
              <span className="font-medium">{totalCount}</span>{' '}
              {totalCount === 1 ? 'document' : 'documente'}
            </>
          ) : (
            'Niciun document'
          )}
        </p>
        {onSortChange && documents.length > 0 && (
          <SortDropdown sortBy={sortBy} sortDirection={sortDirection} onSortChange={onSortChange} />
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Documents */}
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onPreview={() => onPreview(doc)}
            onDownload={() => onDownload(doc)}
            onAddToMapa={onAddToMapa ? () => onAddToMapa(doc) : undefined}
            isDownloading={downloadingId === doc.document.id}
          />
        ))}

        {/* Loading skeletons */}
        {showSkeletons &&
          Array.from({ length: 4 }).map((_, i) => <DocumentCardSkeleton key={`skeleton-${i}`} />)}

        {/* Empty state */}
        {showEmptyState && <EmptyState />}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
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
              <span>Se încarcă...</span>
            </div>
          ) : (
            <button
              onClick={onLoadMore}
              className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Încarcă mai multe
            </button>
          )}
        </div>
      )}
    </div>
  );
}

DocumentGrid.displayName = 'DocumentGrid';
