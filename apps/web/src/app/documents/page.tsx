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

// Mock documents data (30 documents)
const MOCK_DOCUMENTS: DocumentOverview[] = [
  // Smith vs. Johnson (case-001)
  {
    id: 'doc-001',
    title: 'Initial Complaint Filing',
    caseId: 'case-001',
    caseName: 'Smith vs. Johnson',
    type: 'Pleading',
    fileType: 'PDF',
    fileSizeBytes: 245000,
    pageCount: 8,
    uploadedDate: new Date('2024-10-15'),
    lastModifiedDate: new Date('2024-10-15'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    status: 'Filed',
    isReviewed: true,
  },
  {
    id: 'doc-002',
    title: 'Evidence Exhibit A - Property Deed',
    caseId: 'case-001',
    caseName: 'Smith vs. Johnson',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 1200000,
    pageCount: 3,
    uploadedDate: new Date('2024-10-18'),
    lastModifiedDate: new Date('2024-10-20'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    isReviewed: true,
  },
  {
    id: 'doc-003',
    title: 'Motion for Summary Judgment',
    caseId: 'case-001',
    caseName: 'Smith vs. Johnson',
    type: 'Motion',
    fileType: 'DOCX',
    fileSizeBytes: 87000,
    pageCount: 12,
    uploadedDate: new Date('2024-11-01'),
    lastModifiedDate: new Date('2024-11-03'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'atty-2',
    status: 'Draft',
  },
  // Contract Dispute - ABC Corp (case-002)
  {
    id: 'doc-004',
    title: 'Service Agreement - Original Contract',
    caseId: 'case-002',
    caseName: 'Contract Dispute - ABC Corp',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 560000,
    pageCount: 24,
    uploadedDate: new Date('2024-09-01'),
    lastModifiedDate: new Date('2024-09-01'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-005',
    title: 'Breach of Contract Analysis Memo',
    caseId: 'case-002',
    caseName: 'Contract Dispute - ABC Corp',
    type: 'Memo',
    fileType: 'DOCX',
    fileSizeBytes: 125000,
    pageCount: 6,
    uploadedDate: new Date('2024-09-15'),
    lastModifiedDate: new Date('2024-09-16'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Review',
  },
  {
    id: 'doc-006',
    title: 'Client Communication - Demand Letter',
    caseId: 'case-002',
    caseName: 'Contract Dispute - ABC Corp',
    type: 'Letter',
    fileType: 'PDF',
    fileSizeBytes: 42000,
    pageCount: 2,
    uploadedDate: new Date('2024-10-01'),
    lastModifiedDate: new Date('2024-10-01'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-007',
    title: 'Email Correspondence Evidence',
    caseId: 'case-002',
    caseName: 'Contract Dispute - ABC Corp',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 3400000,
    pageCount: 45,
    uploadedDate: new Date('2024-10-10'),
    lastModifiedDate: new Date('2024-10-12'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'atty-2',
    isReviewed: false,
  },
  // M&A Advisory - Tech Partners (case-003)
  {
    id: 'doc-008',
    title: 'Non-Disclosure Agreement (NDA)',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 230000,
    pageCount: 5,
    uploadedDate: new Date('2024-08-01'),
    lastModifiedDate: new Date('2024-08-01'),
    uploadedBy: 'Elena Dumitrescu',
    uploadedById: 'atty-4',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-009',
    title: 'Due Diligence Checklist',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Other',
    fileType: 'XLSX',
    fileSizeBytes: 156000,
    uploadedDate: new Date('2024-08-15'),
    lastModifiedDate: new Date('2024-09-30'),
    uploadedBy: 'Elena Dumitrescu',
    uploadedById: 'atty-4',
    isReviewed: true,
  },
  {
    id: 'doc-010',
    title: 'Purchase Agreement Draft v1',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 478000,
    pageCount: 32,
    uploadedDate: new Date('2024-09-05'),
    lastModifiedDate: new Date('2024-09-10'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'atty-2',
    status: 'Draft',
  },
  {
    id: 'doc-011',
    title: 'Purchase Agreement Draft v2',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 485000,
    pageCount: 34,
    uploadedDate: new Date('2024-09-20'),
    lastModifiedDate: new Date('2024-09-22'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'atty-2',
    status: 'Review',
  },
  {
    id: 'doc-012',
    title: 'Financial Statements Analysis',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Memo',
    fileType: 'PDF',
    fileSizeBytes: 890000,
    pageCount: 18,
    uploadedDate: new Date('2024-10-05'),
    lastModifiedDate: new Date('2024-10-05'),
    uploadedBy: 'Elena Dumitrescu',
    uploadedById: 'atty-4',
    status: 'Review',
  },
  // Divorce - Popa Family (case-004)
  {
    id: 'doc-013',
    title: 'Divorce Petition',
    caseId: 'case-004',
    caseName: 'Divorce - Popa Family',
    type: 'Pleading',
    fileType: 'PDF',
    fileSizeBytes: 178000,
    pageCount: 6,
    uploadedDate: new Date('2024-09-10'),
    lastModifiedDate: new Date('2024-09-10'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    status: 'Filed',
    isReviewed: true,
  },
  {
    id: 'doc-014',
    title: 'Property Division Proposal',
    caseId: 'case-004',
    caseName: 'Divorce - Popa Family',
    type: 'Memo',
    fileType: 'DOCX',
    fileSizeBytes: 92000,
    pageCount: 8,
    uploadedDate: new Date('2024-09-25'),
    lastModifiedDate: new Date('2024-10-01'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    status: 'Review',
  },
  {
    id: 'doc-015',
    title: 'Child Custody Agreement Draft',
    caseId: 'case-004',
    caseName: 'Divorce - Popa Family',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 105000,
    pageCount: 10,
    uploadedDate: new Date('2024-10-15'),
    lastModifiedDate: new Date('2024-10-20'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    status: 'Draft',
  },
  {
    id: 'doc-016',
    title: 'Financial Disclosure Form',
    caseId: 'case-004',
    caseName: 'Divorce - Popa Family',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 2100000,
    pageCount: 22,
    uploadedDate: new Date('2024-10-20'),
    lastModifiedDate: new Date('2024-10-20'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    isReviewed: true,
  },
  // Real Estate - Commercial Property (case-005)
  {
    id: 'doc-017',
    title: 'Commercial Lease Agreement',
    caseId: 'case-005',
    caseName: 'Real Estate - Commercial Property',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 670000,
    pageCount: 28,
    uploadedDate: new Date('2024-08-20'),
    lastModifiedDate: new Date('2024-08-25'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-018',
    title: 'Property Title Report',
    caseId: 'case-005',
    caseName: 'Real Estate - Commercial Property',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 1800000,
    pageCount: 15,
    uploadedDate: new Date('2024-09-01'),
    lastModifiedDate: new Date('2024-09-01'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    isReviewed: true,
  },
  {
    id: 'doc-019',
    title: 'Zoning Compliance Letter',
    caseId: 'case-005',
    caseName: 'Real Estate - Commercial Property',
    type: 'Letter',
    fileType: 'DOCX',
    fileSizeBytes: 38000,
    pageCount: 1,
    uploadedDate: new Date('2024-09-10'),
    lastModifiedDate: new Date('2024-09-12'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    status: 'Draft',
  },
  {
    id: 'doc-020',
    title: 'Environmental Assessment Report',
    caseId: 'case-005',
    caseName: 'Real Estate - Commercial Property',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 4500000,
    pageCount: 67,
    uploadedDate: new Date('2024-10-01'),
    lastModifiedDate: new Date('2024-10-01'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'atty-2',
    isReviewed: false,
  },
  // Criminal Defense - Fraud Case (case-006)
  {
    id: 'doc-021',
    title: 'Defense Strategy Memo',
    caseId: 'case-006',
    caseName: 'Criminal Defense - Fraud Case',
    type: 'Memo',
    fileType: 'DOCX',
    fileSizeBytes: 145000,
    pageCount: 9,
    uploadedDate: new Date('2024-10-01'),
    lastModifiedDate: new Date('2024-10-05'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Review',
  },
  {
    id: 'doc-022',
    title: 'Motion to Suppress Evidence',
    caseId: 'case-006',
    caseName: 'Criminal Defense - Fraud Case',
    type: 'Motion',
    fileType: 'PDF',
    fileSizeBytes: 210000,
    pageCount: 15,
    uploadedDate: new Date('2024-10-10'),
    lastModifiedDate: new Date('2024-10-12'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    status: 'Filed',
    isReviewed: true,
  },
  {
    id: 'doc-023',
    title: 'Witness List',
    caseId: 'case-006',
    caseName: 'Criminal Defense - Fraud Case',
    type: 'Other',
    fileType: 'TXT',
    fileSizeBytes: 8000,
    uploadedDate: new Date('2024-10-15'),
    lastModifiedDate: new Date('2024-11-01'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    isReviewed: true,
  },
  {
    id: 'doc-024',
    title: 'Expert Witness Report - Financial Analysis',
    caseId: 'case-006',
    caseName: 'Criminal Defense - Fraud Case',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 1900000,
    pageCount: 34,
    uploadedDate: new Date('2024-10-25'),
    lastModifiedDate: new Date('2024-10-28'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    isReviewed: true,
  },
  {
    id: 'doc-025',
    title: 'Cross-Examination Prep Notes',
    caseId: 'case-006',
    caseName: 'Criminal Defense - Fraud Case',
    type: 'Memo',
    fileType: 'DOCX',
    fileSizeBytes: 67000,
    pageCount: 5,
    uploadedDate: new Date('2024-11-05'),
    lastModifiedDate: new Date('2024-11-08'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Draft',
  },
  // Additional miscellaneous documents
  {
    id: 'doc-026',
    title: 'Settlement Conference Memo',
    caseId: 'case-001',
    caseName: 'Smith vs. Johnson',
    type: 'Memo',
    fileType: 'PDF',
    fileSizeBytes: 98000,
    pageCount: 7,
    uploadedDate: new Date('2024-11-10'),
    lastModifiedDate: new Date('2024-11-12'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    status: 'Review',
  },
  {
    id: 'doc-027',
    title: 'Amendment to Service Agreement',
    caseId: 'case-002',
    caseName: 'Contract Dispute - ABC Corp',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 112000,
    pageCount: 8,
    uploadedDate: new Date('2024-11-01'),
    lastModifiedDate: new Date('2024-11-05'),
    uploadedBy: 'Andrei Georgescu',
    uploadedById: 'atty-3',
    status: 'Draft',
  },
  {
    id: 'doc-028',
    title: 'Board Resolution - Merger Approval',
    caseId: 'case-003',
    caseName: 'M&A Advisory - Tech Partners',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 154000,
    pageCount: 4,
    uploadedDate: new Date('2024-10-28'),
    lastModifiedDate: new Date('2024-10-28'),
    uploadedBy: 'Elena Dumitrescu',
    uploadedById: 'atty-4',
    isReviewed: true,
  },
  {
    id: 'doc-029',
    title: 'Mediation Agreement',
    caseId: 'case-004',
    caseName: 'Divorce - Popa Family',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 189000,
    pageCount: 6,
    uploadedDate: new Date('2024-11-01'),
    lastModifiedDate: new Date('2024-11-03'),
    uploadedBy: 'Victor Popa',
    uploadedById: 'atty-5',
    status: 'Review',
  },
  {
    id: 'doc-030',
    title: 'Closing Statement',
    caseId: 'case-005',
    caseName: 'Real Estate - Commercial Property',
    type: 'Other',
    fileType: 'XLSX',
    fileSizeBytes: 234000,
    uploadedDate: new Date('2024-11-08'),
    lastModifiedDate: new Date('2024-11-10'),
    uploadedBy: 'Ion Popescu',
    uploadedById: 'atty-1',
    isReviewed: false,
  },
];

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
