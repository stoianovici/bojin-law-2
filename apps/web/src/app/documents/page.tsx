/**
 * Documents List Page
 * Lists all documents with filtering, sorting, search, and pagination
 */

'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useDocumentsStore } from '../../stores/documents.store';
import { DocumentFilters } from '../../components/documents/DocumentFilters';
import { DocumentSortMenu } from '../../components/documents/DocumentSortMenu';
import { DocumentSearchBar } from '../../components/documents/DocumentSearchBar';
import type { DocumentOverview } from '@legal-platform/types';

// Documents should be fetched from API - empty array for clean state
const MOCK_DOCUMENTS: DocumentOverview[] = [];

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const {
    filteredDocuments,
    totalItems,
    currentPage,
    itemsPerPage,
    setDocuments,
    setPage,
    loadFromLocalStorage,
  } = useDocumentsStore();

  // Load documents and filters on mount
  useEffect(() => {
    document.title = 'Documente';
    setDocuments(MOCK_DOCUMENTS);
    loadFromLocalStorage();
  }, [setDocuments, loadFromLocalStorage]);

  // Paginated documents
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <DocumentSearchBar />
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-64 flex-shrink-0">
            <DocumentFilters />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Header with Sort Menu and Result Count */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Se afișează {paginatedDocuments.length} din {totalItems} documente
              </div>
              <DocumentSortMenu />
            </div>

            {/* Documents List */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              {paginatedDocuments.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  Nu s-au găsit documente care să corespundă filtrelor.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {paginatedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-900">
                              {doc.title}
                            </h3>
                            {doc.isSigned && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                ✓ Semnat
                              </span>
                            )}
                            {doc.isReviewed !== undefined && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  doc.isReviewed
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {doc.isReviewed ? 'Verificat' : 'Neverificat'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Caz:</span> {doc.caseName}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {doc.type}
                            </span>
                            <span>{doc.fileType}</span>
                            <span>{formatFileSize(doc.fileSizeBytes)}</span>
                            {doc.pageCount && <span>{doc.pageCount} pagini</span>}
                            <span>Încărcat: {doc.uploadedDate.toLocaleDateString('ro-RO')}</span>
                            <span>De: {doc.uploadedBy}</span>
                          </div>
                        </div>

                        <Link
                          href={`/documents/${doc.id}/edit`}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Vizualizare
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Pagina {currentPage} din {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Următorul
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
