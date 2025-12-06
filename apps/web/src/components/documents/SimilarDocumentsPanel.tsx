/**
 * Similar Documents Panel Component
 * Story 3.3: Intelligent Document Drafting
 *
 * Displays top 5 similar documents from firm library
 * Features: similarity scores, document preview, use as reference
 */

'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import type { PrecedentDocument, DocumentType } from '@legal-platform/types';

export interface SimilarDocumentsPanelProps {
  /** Case ID for context */
  caseId: string;
  /** Document type to filter similar documents */
  documentType: DocumentType;
  /** Callback when a document is selected as reference */
  onUseAsReference?: (document: PrecedentDocument) => void;
  /** Callback when document preview is requested */
  onPreview?: (document: PrecedentDocument) => void;
  /** Maximum number of documents to display */
  maxDocuments?: number;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Panel showing similar documents from the firm library
 */
export function SimilarDocumentsPanel({
  caseId,
  documentType,
  onUseAsReference,
  onPreview,
  maxDocuments = 5,
  compact = false,
}: SimilarDocumentsPanelProps) {
  const [documents, setDocuments] = useState<PrecedentDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<DocumentType | 'all'>('all');
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null);

  // Fetch similar documents
  useEffect(() => {
    fetchSimilarDocuments();
  }, [caseId, documentType]);

  const fetchSimilarDocuments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual GraphQL query
      // const { data } = await client.query({
      //   query: FIND_SIMILAR_DOCUMENTS_QUERY,
      //   variables: {
      //     caseId,
      //     documentType,
      //     limit: maxDocuments,
      //   },
      // });

      // TODO: Fetch from GraphQL API - empty array for clean state
      const documents: PrecedentDocument[] = [];

      setDocuments(documents.slice(0, maxDocuments));
    } catch (err) {
      setError('Nu s-au putut încărca documentele similare');
      console.error('Failed to fetch similar documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get similarity badge color
  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.8) return 'bg-green-100 text-green-700 border-green-200';
    if (similarity >= 0.6) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  // Get similarity indicator width
  const getSimilarityWidth = (similarity: number): string => {
    return `${Math.round(similarity * 100)}%`;
  };

  // Filter documents by type
  const filteredDocuments = selectedFilter === 'all'
    ? documents
    : documents.filter((doc) => doc.category === selectedFilter);

  // Render loading state
  if (isLoading) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200', !compact && 'p-6')}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200', !compact && 'p-6')}>
        <div className="text-center text-gray-500">
          <svg
            className="w-8 h-8 mx-auto mb-2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchSimilarDocuments}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Reîncearcă
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (documents.length === 0) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200', !compact && 'p-6')}>
        <div className="text-center text-gray-500">
          <svg
            className="w-8 h-8 mx-auto mb-2 text-gray-400"
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
          <p className="text-sm">Nu s-au găsit documente similare</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200 overflow-hidden')}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Documente Similare
          </h3>
          <span className="text-xs text-gray-500">
            {filteredDocuments.length} găsite
          </span>
        </div>

        {/* Filter Pills */}
        {!compact && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={clsx(
                'px-2 py-1 text-xs rounded-full transition-colors',
                selectedFilter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Toate
            </button>
            <button
              onClick={() => setSelectedFilter(documentType)}
              className={clsx(
                'px-2 py-1 text-xs rounded-full transition-colors',
                selectedFilter === documentType
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {documentType}
            </button>
          </div>
        )}
      </div>

      {/* Documents List */}
      <ul className="divide-y divide-gray-100">
        {filteredDocuments.map((doc) => (
          <li
            key={doc.documentId}
            className={clsx(
              'px-4 py-3 transition-colors',
              'hover:bg-gray-50',
              hoveredDoc === doc.documentId && 'bg-gray-50'
            )}
            onMouseEnter={() => setHoveredDoc(doc.documentId)}
            onMouseLeave={() => setHoveredDoc(null)}
          >
            {/* Document Title Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <button
                onClick={() => onPreview?.(doc)}
                className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left line-clamp-1"
              >
                {doc.title}
              </button>
              <span
                className={clsx(
                  'flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border',
                  getSimilarityColor(doc.similarity)
                )}
              >
                {Math.round(doc.similarity * 100)}%
              </span>
            </div>

            {/* Similarity Bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  doc.similarity >= 0.8 ? 'bg-green-500' :
                  doc.similarity >= 0.6 ? 'bg-yellow-500' : 'bg-gray-400'
                )}
                style={{ width: getSimilarityWidth(doc.similarity) }}
              />
            </div>

            {/* Relevant Sections */}
            {!compact && doc.relevantSections.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Secțiuni relevante:</p>
                <div className="flex flex-wrap gap-1">
                  {doc.relevantSections.slice(0, 2).map((section, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded truncate max-w-[200px]"
                      title={section}
                    >
                      {section}
                    </span>
                  ))}
                  {doc.relevantSections.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{doc.relevantSections.length - 2} mai multe
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={clsx(
              'flex items-center gap-2 transition-opacity',
              hoveredDoc === doc.documentId ? 'opacity-100' : 'opacity-0'
            )}>
              <button
                onClick={() => onPreview?.(doc)}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Previzualizare
              </button>
              <button
                onClick={() => onUseAsReference?.(doc)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Folosește ca referință
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      {!compact && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            Bazat pe analiză semantică a bibliotecii firmei
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Document Preview Modal Component
 */
export interface DocumentPreviewModalProps {
  /** Document to preview */
  document: PrecedentDocument | null;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback to use document as reference */
  onUseAsReference?: (document: PrecedentDocument) => void;
}

export function DocumentPreviewModal({
  document,
  isOpen,
  onClose,
  onUseAsReference,
}: DocumentPreviewModalProps) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {document.title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">{document.category}</span>
              <span className="text-sm text-gray-300">•</span>
              <span className="text-sm text-green-600">
                {Math.round(document.similarity * 100)}% similaritate
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Secțiuni Relevante
            </h4>
            <div className="space-y-3">
              {document.relevantSections.map((section, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <p className="text-sm text-gray-800">{section}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Închide
            </button>
            <button
              onClick={() => {
                onUseAsReference?.(document);
                onClose();
              }}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Folosește ca referință
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimilarDocumentsPanel;
