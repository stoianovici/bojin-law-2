'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  FileText,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import ReclassifyModal from './ReclassifyModal';

// ============================================================================
// Types
// ============================================================================

interface UncertainDocument {
  id: string;
  fileName: string;
  fileExtension: string;
  textPreview: string | null;
  emailSubject: string | null;
  emailSender: string | null;
  emailDate: string | null;
  triageStatus: string;
  triageConfidence: number | null;
  triageReason: string | null;
  suggestedDocType: string | null;
  hasFile: boolean;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface UncertainDocsReviewProps {
  sessionId: string;
  onUpdate: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function UncertainDocsReview({ sessionId, onUpdate }: UncertainDocsReviewProps) {
  const [documents, setDocuments] = useState<UncertainDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reclassify modal state
  const [reclassifyingDoc, setReclassifyingDoc] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/uncertain-docs?sessionId=${sessionId}&page=${currentPage}&pageSize=20`
      );
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentPage]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Delete single document
  const deleteDocument = async (documentId: string) => {
    setActionLoading(documentId);
    try {
      const res = await fetch('/api/uncertain-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, action: 'delete' }),
      });

      if (!res.ok) throw new Error('Failed to delete document');

      // Remove from list
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      onUpdate();
    } catch (err) {
      console.error('Error deleting document:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Open reclassify modal
  const openReclassifyModal = (doc: UncertainDocument) => {
    setReclassifyingDoc({ id: doc.id, fileName: doc.fileName });
    setIsReclassifyModalOpen(true);
  };

  // Handle reclassify submission
  const handleReclassifySubmit = async (reclassificationNote: string) => {
    if (!reclassifyingDoc) return;

    setIsReclassifying(true);
    try {
      const res = await fetch('/api/uncertain-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: reclassifyingDoc.id,
          action: 'reclassify',
          reclassificationNote,
        }),
      });

      if (!res.ok) throw new Error('Failed to reclassify document');

      // Remove from list and close modal
      setDocuments((prev) => prev.filter((d) => d.id !== reclassifyingDoc.id));
      setIsReclassifyModalOpen(false);
      setReclassifyingDoc(null);
      onUpdate();
    } catch (err) {
      console.error('Error reclassifying document:', err);
    } finally {
      setIsReclassifying(false);
    }
  };

  // Bulk delete
  const bulkDelete = async () => {
    if (selectedDocs.size === 0) return;

    setActionLoading('bulk');
    try {
      const res = await fetch('/api/uncertain-docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentIds: Array.from(selectedDocs),
          action: 'delete',
        }),
      });

      if (!res.ok) throw new Error('Failed to delete documents');

      // Remove deleted docs from list
      setDocuments((prev) => prev.filter((d) => !selectedDocs.has(d.id)));
      setSelectedDocs(new Set());
      onUpdate();
    } catch (err) {
      console.error('Error bulk deleting:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle document selection
  const toggleSelection = (docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Select all on page
  const selectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map((d) => d.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          Aceste documente necesită atenție. Puteți șterge documentele irelevante sau reclasifica
          documentele pentru a fi incluse în gruparea automată.
        </p>
      </div>

      {/* Bulk Actions */}
      {selectedDocs.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">
            {selectedDocs.size} document(e) selectat(e)
          </span>
          <button
            onClick={bulkDelete}
            disabled={actionLoading === 'bulk'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {actionLoading === 'bulk' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Șterge selectate
              </>
            )}
          </button>
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Toate documentele incerte au fost clasificate!
          </p>
        </div>
      ) : (
        <>
          {/* Select All Header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              checked={selectedDocs.size === documents.length}
              onChange={selectAll}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">Selectează toate ({documents.length})</span>
          </div>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`bg-white rounded-lg border ${
                  selectedDocs.has(doc.id)
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-gray-200'
                } p-4`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.id)}
                    onChange={() => toggleSelection(doc.id)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 mt-1"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900 truncate">{doc.fileName}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {doc.fileExtension}
                        </span>
                      </div>
                      {doc.hasFile && (
                        <button
                          onClick={() =>
                            window.open(`/api/document-proxy?documentId=${doc.id}`, '_blank')
                          }
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-3 w-3" />
                          Vizualizează
                        </button>
                      )}
                    </div>

                    {/* Email info */}
                    {(doc.emailSubject || doc.emailSender) && (
                      <div className="text-xs text-gray-500 mb-2">
                        {doc.emailSubject && <span>Subiect: {doc.emailSubject}</span>}
                        {doc.emailSender && <span className="ml-3">De la: {doc.emailSender}</span>}
                      </div>
                    )}

                    {/* AI suggestion */}
                    {doc.triageReason && (
                      <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2 inline-block">
                        AI: {doc.triageReason}
                        {doc.triageConfidence && (
                          <span className="ml-1">
                            ({Math.round(doc.triageConfidence * 100)}% încredere)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Text preview */}
                    {doc.textPreview && (
                      <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap mb-3">
                        {doc.textPreview}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        disabled={actionLoading === doc.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
                      >
                        {actionLoading === doc.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3" />
                            Șterge
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => openReclassifyModal(doc)}
                        disabled={actionLoading === doc.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Reclasifică
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="text-sm text-gray-500">
                Pagina {pagination.page} din {pagination.totalPages} ({pagination.totalCount}{' '}
                documente)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reclassify Modal */}
      <ReclassifyModal
        isOpen={isReclassifyModalOpen}
        onClose={() => {
          setIsReclassifyModalOpen(false);
          setReclassifyingDoc(null);
        }}
        onSubmit={handleReclassifySubmit}
        document={reclassifyingDoc}
        isLoading={isReclassifying}
      />
    </div>
  );
}
