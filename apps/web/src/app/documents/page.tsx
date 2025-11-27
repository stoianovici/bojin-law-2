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

// Realistic Romanian legal documents mock data
const MOCK_DOCUMENTS: DocumentOverview[] = [
  // SC ABC Industries SRL - Corporate/Commercial
  {
    id: 'doc-001',
    title: 'Contract de Furnizare Produse - ABC Industries',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 245000,
    pageCount: 12,
    uploadedDate: new Date('2024-08-28'),
    lastModifiedDate: new Date('2024-08-28'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-002',
    title: 'Anexa 1 - Specificatii Tehnice',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 180000,
    pageCount: 8,
    uploadedDate: new Date('2024-08-31'),
    lastModifiedDate: new Date('2024-08-31'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-003',
    title: 'Cerere de Chemare in Judecata - Litigiu Comercial',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Pleading',
    fileType: 'DOCX',
    fileSizeBytes: 85000,
    pageCount: 15,
    uploadedDate: new Date('2024-09-03'),
    lastModifiedDate: new Date('2024-09-05'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Filed',
    isReviewed: true,
  },
  {
    id: 'doc-004',
    title: 'Intampinare - Dosar 1234-2025',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Pleading',
    fileType: 'DOCX',
    fileSizeBytes: 92000,
    pageCount: 10,
    uploadedDate: new Date('2024-09-06'),
    lastModifiedDate: new Date('2024-11-20'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Draft',
  },
  {
    id: 'doc-005',
    title: 'Memoriu de Aparare',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Motion',
    fileType: 'PDF',
    fileSizeBytes: 156000,
    pageCount: 18,
    uploadedDate: new Date('2024-09-09'),
    lastModifiedDate: new Date('2024-09-09'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-006',
    title: 'Procura Speciala - Reprezentare Instanta',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 45000,
    pageCount: 2,
    uploadedDate: new Date('2024-09-12'),
    lastModifiedDate: new Date('2024-09-12'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-007',
    title: 'Raport Expertiza Contabila',
    caseId: 'case-001',
    caseName: 'Litigiu Contract - ABC Industries vs XYZ Logistics',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 890000,
    pageCount: 45,
    uploadedDate: new Date('2024-09-15'),
    lastModifiedDate: new Date('2024-09-15'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-008',
    title: 'Act Aditional nr. 2 - Contract Furnizare',
    caseId: 'case-002',
    caseName: 'Contract Review - ABC Industries',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 67000,
    pageCount: 5,
    uploadedDate: new Date('2024-09-18'),
    lastModifiedDate: new Date('2024-11-18'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Draft',
  },
  {
    id: 'doc-009',
    title: 'Notificare Reziliere Contract',
    caseId: 'case-002',
    caseName: 'Contract Review - ABC Industries',
    type: 'Letter',
    fileType: 'PDF',
    fileSizeBytes: 38000,
    pageCount: 3,
    uploadedDate: new Date('2024-09-21'),
    lastModifiedDate: new Date('2024-09-21'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-010',
    title: 'Dovada Comunicare - Notificare',
    caseId: 'case-002',
    caseName: 'Contract Review - ABC Industries',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 125000,
    pageCount: 4,
    uploadedDate: new Date('2024-09-24'),
    lastModifiedDate: new Date('2024-09-24'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
  },
  // Familia Popescu - Real Estate/Successions
  {
    id: 'doc-011',
    title: 'Contract de Vanzare-Cumparare Imobil',
    caseId: 'case-006',
    caseName: 'Tranzactie Imobiliara - Familia Popescu',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 320000,
    pageCount: 20,
    uploadedDate: new Date('2024-09-27'),
    lastModifiedDate: new Date('2024-09-27'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-012',
    title: 'Extras Carte Funciara',
    caseId: 'case-006',
    caseName: 'Tranzactie Imobiliara - Familia Popescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 89000,
    pageCount: 3,
    uploadedDate: new Date('2024-09-30'),
    lastModifiedDate: new Date('2024-09-30'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-013',
    title: 'Certificat Fiscal',
    caseId: 'case-006',
    caseName: 'Tranzactie Imobiliara - Familia Popescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 56000,
    pageCount: 2,
    uploadedDate: new Date('2024-10-03'),
    lastModifiedDate: new Date('2024-10-03'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-014',
    title: 'Testament Olograf - Draft',
    caseId: 'case-007',
    caseName: 'Planificare Succesorala - Familia Popescu',
    type: 'Other',
    fileType: 'DOCX',
    fileSizeBytes: 42000,
    pageCount: 4,
    uploadedDate: new Date('2024-10-06'),
    lastModifiedDate: new Date('2024-11-15'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Draft',
  },
  {
    id: 'doc-015',
    title: 'Declaratie Notariala - Succesiune',
    caseId: 'case-007',
    caseName: 'Planificare Succesorala - Familia Popescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 78000,
    pageCount: 5,
    uploadedDate: new Date('2024-10-09'),
    lastModifiedDate: new Date('2024-10-09'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-016',
    title: 'Certificat de Mostenitor',
    caseId: 'case-007',
    caseName: 'Planificare Succesorala - Familia Popescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 95000,
    pageCount: 6,
    uploadedDate: new Date('2024-10-12'),
    lastModifiedDate: new Date('2024-10-12'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Approved',
    isReviewed: true,
  },
  // Tech Innovations Romania - IT/Corporate
  {
    id: 'doc-017',
    title: 'Contract de Licenta Software',
    caseId: 'case-012',
    caseName: 'M&A Advisory - Tech Innovations',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 210000,
    pageCount: 15,
    uploadedDate: new Date('2024-10-15'),
    lastModifiedDate: new Date('2024-10-15'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-018',
    title: 'NDA - Acord de Confidentialitate',
    caseId: 'case-012',
    caseName: 'M&A Advisory - Tech Innovations',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 85000,
    pageCount: 8,
    uploadedDate: new Date('2024-10-18'),
    lastModifiedDate: new Date('2024-10-18'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
    isSigned: true,
  },
  {
    id: 'doc-019',
    title: 'Statut SRL - Actualizat 2025',
    caseId: 'case-014',
    caseName: 'Infiintare SRL - Tech Innovations',
    type: 'Other',
    fileType: 'DOCX',
    fileSizeBytes: 125000,
    pageCount: 12,
    uploadedDate: new Date('2024-10-21'),
    lastModifiedDate: new Date('2024-11-12'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Draft',
  },
  {
    id: 'doc-020',
    title: 'Hotarare AGA - Majorare Capital',
    caseId: 'case-014',
    caseName: 'Infiintare SRL - Tech Innovations',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 67000,
    pageCount: 4,
    uploadedDate: new Date('2024-10-24'),
    lastModifiedDate: new Date('2024-10-24'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-021',
    title: 'Contract de Cesiune Parti Sociale',
    caseId: 'case-012',
    caseName: 'M&A Advisory - Tech Innovations',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 98000,
    pageCount: 10,
    uploadedDate: new Date('2024-10-27'),
    lastModifiedDate: new Date('2024-11-09'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Draft',
  },
  {
    id: 'doc-022',
    title: 'Due Diligence Report - M&A',
    caseId: 'case-012',
    caseName: 'M&A Advisory - Tech Innovations',
    type: 'Memo',
    fileType: 'PDF',
    fileSizeBytes: 1250000,
    pageCount: 85,
    uploadedDate: new Date('2024-10-30'),
    lastModifiedDate: new Date('2024-10-30'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-023',
    title: 'Term Sheet - Investitie Serie A',
    caseId: 'case-012',
    caseName: 'M&A Advisory - Tech Innovations',
    type: 'Contract',
    fileType: 'PDF',
    fileSizeBytes: 156000,
    pageCount: 12,
    uploadedDate: new Date('2024-11-02'),
    lastModifiedDate: new Date('2024-11-06'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Draft',
  },
  {
    id: 'doc-024',
    title: 'Politica GDPR - Protectia Datelor',
    caseId: 'case-010',
    caseName: 'Conformitate GDPR - ABC Industries',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 189000,
    pageCount: 25,
    uploadedDate: new Date('2024-11-05'),
    lastModifiedDate: new Date('2024-11-05'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-025',
    title: 'Contract de Munca - Model Director',
    caseId: 'case-014',
    caseName: 'Infiintare SRL - Tech Innovations',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 95000,
    pageCount: 8,
    uploadedDate: new Date('2024-11-08'),
    lastModifiedDate: new Date('2024-11-08'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
  },
  // Familia Ionescu - Family Law/Divorce
  {
    id: 'doc-026',
    title: 'Cerere de Divort',
    caseId: 'case-013',
    caseName: 'Divort - Familia Ionescu',
    type: 'Pleading',
    fileType: 'DOCX',
    fileSizeBytes: 58000,
    pageCount: 8,
    uploadedDate: new Date('2024-11-11'),
    lastModifiedDate: new Date('2024-11-20'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Draft',
  },
  {
    id: 'doc-027',
    title: 'Conventie Privind Custodia',
    caseId: 'case-013',
    caseName: 'Divort - Familia Ionescu',
    type: 'Contract',
    fileType: 'DOCX',
    fileSizeBytes: 72000,
    pageCount: 10,
    uploadedDate: new Date('2024-11-14'),
    lastModifiedDate: new Date('2024-11-18'),
    uploadedBy: 'Elena Popa',
    uploadedById: 'paralegal1',
    status: 'Draft',
  },
  {
    id: 'doc-028',
    title: 'Inventar Bunuri Comune',
    caseId: 'case-013',
    caseName: 'Divort - Familia Ionescu',
    type: 'Other',
    fileType: 'XLSX',
    fileSizeBytes: 45000,
    uploadedDate: new Date('2024-11-17'),
    lastModifiedDate: new Date('2024-11-17'),
    uploadedBy: 'Mihai Dumitrescu',
    uploadedById: 'paralegal2',
    status: 'Draft',
  },
  {
    id: 'doc-029',
    title: 'Certificat de Casatorie',
    caseId: 'case-013',
    caseName: 'Divort - Familia Ionescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 28000,
    pageCount: 1,
    uploadedDate: new Date('2024-11-20'),
    lastModifiedDate: new Date('2024-11-20'),
    uploadedBy: 'Maria Ionescu',
    uploadedById: 'associate1',
    status: 'Approved',
    isReviewed: true,
  },
  {
    id: 'doc-030',
    title: 'Acte Proprietate Apartament',
    caseId: 'case-013',
    caseName: 'Divort - Familia Ionescu',
    type: 'Other',
    fileType: 'PDF',
    fileSizeBytes: 450000,
    pageCount: 25,
    uploadedDate: new Date('2024-11-23'),
    lastModifiedDate: new Date('2024-11-23'),
    uploadedBy: 'Ion Georgescu',
    uploadedById: 'associate2',
    status: 'Approved',
    isReviewed: true,
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
