'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  FileText,
  Eye,
  CheckSquare,
  Square,
  Edit3,
} from 'lucide-react';
import ReclassifyModal from './ReclassifyModal';

// ============================================================================
// Types
// ============================================================================

type TriageStatus = 'FirmDrafted' | 'ThirdParty' | 'Irrelevant' | 'CourtDoc' | 'Uncertain';
type ValidationStatus = 'Pending' | 'Accepted' | 'Deleted' | 'Reclassified';

interface ClusterDocument {
  id: string;
  fileName: string;
  fileExtension: string;
  textPreview: string | null;
  emailSubject: string | null;
  emailSender: string | null;
  emailDate: string | null;
  hasFile: boolean;
  triageStatus: TriageStatus | null;
  triageConfidence: number | null;
  triageReason: string | null;
  suggestedDocType: string | null;
  validationStatus: ValidationStatus;
  validatedAt: string | null;
  reclassificationNote: string | null;
}

interface ClusterInfo {
  id: string;
  name: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  deleted: number;
  reclassified: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface ClusterDocumentBrowserProps {
  clusterId: string;
  clusterName: string;
  onClose: () => void;
  onUpdate: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const TRIAGE_STATUS_CONFIG: Record<TriageStatus, { label: string; color: string; bg: string }> = {
  FirmDrafted: { label: 'Redactat intern', color: 'text-green-700', bg: 'bg-green-100' },
  ThirdParty: { label: 'Terți', color: 'text-blue-700', bg: 'bg-blue-100' },
  CourtDoc: { label: 'Act instanță', color: 'text-purple-700', bg: 'bg-purple-100' },
  Irrelevant: { label: 'Irelevant', color: 'text-gray-600', bg: 'bg-gray-100' },
  Uncertain: { label: 'Incert', color: 'text-amber-700', bg: 'bg-amber-100' },
};

const VALIDATION_STATUS_CONFIG: Record<
  ValidationStatus,
  { label: string; color: string; bg: string }
> = {
  Pending: { label: 'In asteptare', color: 'text-amber-700', bg: 'bg-amber-100' },
  Accepted: { label: 'Acceptat', color: 'text-green-700', bg: 'bg-green-100' },
  Deleted: { label: 'Sters', color: 'text-red-700', bg: 'bg-red-100' },
  Reclassified: { label: 'Reclasificat', color: 'text-blue-700', bg: 'bg-blue-100' },
};

// ============================================================================
// Component
// ============================================================================

export function ClusterDocumentBrowser({
  clusterId,
  clusterName,
  onClose,
  onUpdate,
}: ClusterDocumentBrowserProps) {
  const [documents, setDocuments] = useState<ClusterDocument[]>([]);
  const [_cluster, setCluster] = useState<ClusterInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Reclassify modal state
  const [reclassifyingDoc, setReclassifyingDoc] = useState<{ id: string; fileName: string } | null>(
    null
  );
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Preview
  const [previewDoc, setPreviewDoc] = useState<ClusterDocument | null>(null);
  const [previewFullText, setPreviewFullText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/clusters/${clusterId}/documents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();

      setCluster(data.cluster);
      setDocuments(data.documents);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching cluster documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clusterId, page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle single document action
  const handleDocAction = async (
    docId: string,
    action: 'accept' | 'delete',
    reclassificationNote?: string
  ) => {
    setActionLoading(docId);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, action, reclassificationNote }),
      });

      if (!res.ok) throw new Error('Action failed');

      // Find the document to get its current status
      const doc = documents.find((d) => d.id === docId);
      const previousStatus = doc?.validationStatus || 'Pending';

      // Determine new status
      const newStatus: ValidationStatus = action === 'accept' ? 'Accepted' : 'Deleted';

      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, validationStatus: newStatus } : d))
      );

      // Update stats
      if (stats) {
        const newStats = { ...stats };
        // Decrement previous status count
        if (previousStatus === 'Pending') newStats.pending--;
        else if (previousStatus === 'Accepted') newStats.accepted--;
        else if (previousStatus === 'Deleted') newStats.deleted--;
        else if (previousStatus === 'Reclassified') newStats.reclassified--;

        // Increment new status count
        if (action === 'accept') newStats.accepted++;
        else newStats.deleted++;

        setStats(newStats);
      }

      onUpdate();
    } catch (err) {
      console.error('Error performing action:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reclassify action
  const handleReclassify = async (note: string) => {
    if (!reclassifyingDoc) return;

    setIsReclassifying(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: reclassifyingDoc.id,
          action: 'reclassify',
          reclassificationNote: note,
        }),
      });

      if (!res.ok) throw new Error('Reclassify failed');

      // Find the document to get its current status
      const doc = documents.find((d) => d.id === reclassifyingDoc.id);
      const previousStatus = doc?.validationStatus || 'Pending';

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === reclassifyingDoc.id
            ? { ...d, validationStatus: 'Reclassified', reclassificationNote: note }
            : d
        )
      );

      // Update stats
      if (stats) {
        const newStats = { ...stats };
        // Decrement previous status count
        if (previousStatus === 'Pending') newStats.pending--;
        else if (previousStatus === 'Accepted') newStats.accepted--;
        else if (previousStatus === 'Deleted') newStats.deleted--;
        else if (previousStatus === 'Reclassified') newStats.reclassified--;

        // Increment reclassified count
        newStats.reclassified++;

        setStats(newStats);
      }

      setIsReclassifyModalOpen(false);
      setReclassifyingDoc(null);
      onUpdate();
    } catch (err) {
      console.error('Error reclassifying document:', err);
    } finally {
      setIsReclassifying(false);
    }
  };

  // Open reclassify modal
  const openReclassifyModal = (doc: ClusterDocument) => {
    setReclassifyingDoc({ id: doc.id, fileName: doc.fileName });
    setIsReclassifyModalOpen(true);
  };

  // Handle bulk actions
  const handleBulkAction = async (action: 'accept' | 'delete') => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch(`/api/clusters/${clusterId}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedIds), action }),
      });

      if (!res.ok) throw new Error('Bulk action failed');

      // Refresh data
      await fetchDocuments();
      setSelectedIds(new Set());
      onUpdate();
    } catch (err) {
      console.error('Error performing bulk action:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Toggle selection
  const toggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  // Select all on page
  const selectAllOnPage = () => {
    const allSelected = documents.every((d) => selectedIds.has(d.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  // Fetch full text for preview
  const openPreview = async (doc: ClusterDocument) => {
    setPreviewDoc(doc);
    setPreviewFullText(null);
    setPreviewLoading(true);

    try {
      const res = await fetch(`/api/document-text?documentId=${doc.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewFullText(data.extractedText);
      }
    } catch (err) {
      console.error('Error fetching document text:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{clusterName}</h2>
            {stats && (
              <div className="flex gap-4 mt-1 text-sm">
                <span className="text-gray-600">Total: {stats.total}</span>
                <span className="text-amber-600">In asteptare: {stats.pending}</span>
                <span className="text-green-600">Acceptate: {stats.accepted}</span>
                <span className="text-red-600">Sterse: {stats.deleted}</span>
                <span className="text-blue-600">Reclasificate: {stats.reclassified}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Caută după nume sau subiect..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ValidationStatus | 'all');
              setPage(1);
            }}
            className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toate statusurile</option>
            <option value="Pending">In asteptare</option>
            <option value="Accepted">Acceptate</option>
            <option value="Deleted">Sterse</option>
            <option value="Reclassified">Reclasificate</option>
          </select>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedIds.size} selectate</span>
              <button
                onClick={() => handleBulkAction('accept')}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                Accepta toate
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                disabled={bulkActionLoading}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Sterge toate
              </button>
            </div>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-12 h-12 mb-2" />
              <p>Nu sunt documente care să corespundă filtrelor</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={selectAllOnPage}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700"
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Document
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Clasificare AI
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Status validare
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((doc) => {
                  const triageConfig = doc.triageStatus
                    ? TRIAGE_STATUS_CONFIG[doc.triageStatus]
                    : null;
                  const statusConfig = VALIDATION_STATUS_CONFIG[doc.validationStatus];
                  const isSelected = selectedIds.has(doc.id);

                  return (
                    <tr key={doc.id} className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(doc.id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-xs">
                              {doc.fileName}
                            </p>
                            {doc.emailSubject && (
                              <p className="text-sm text-gray-500 truncate max-w-xs">
                                {doc.emailSubject}
                              </p>
                            )}
                            {doc.suggestedDocType && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Tip: {doc.suggestedDocType}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {triageConfig && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${triageConfig.bg} ${triageConfig.color}`}
                          >
                            {triageConfig.label}
                            {doc.triageConfidence && (
                              <span className="ml-1 opacity-75">
                                ({Math.round(doc.triageConfidence * 100)}%)
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                          {doc.reclassificationNote && (
                            <p
                              className="text-xs text-gray-500 mt-1 truncate max-w-xs"
                              title={doc.reclassificationNote}
                            >
                              {doc.reclassificationNote}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openPreview(doc)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                            title="Vizualizeaza"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDocAction(doc.id, 'accept')}
                            disabled={actionLoading === doc.id}
                            className="p-1.5 hover:bg-green-100 rounded text-green-600 disabled:opacity-50"
                            title="Accepta"
                          >
                            {actionLoading === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDocAction(doc.id, 'delete')}
                            disabled={actionLoading === doc.id}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600 disabled:opacity-50"
                            title="Sterge"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReclassifyModal(doc)}
                            disabled={actionLoading === doc.id}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600 disabled:opacity-50"
                            title="Reclasifica"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Pagina {pagination.page} din {pagination.totalPages} ({pagination.totalCount}{' '}
              documente)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{previewDoc.fileName}</h3>
                {previewDoc.emailSubject && (
                  <p className="text-sm text-gray-500">{previewDoc.emailSubject}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {previewLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : previewFullText ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                  {previewFullText}
                </pre>
              ) : (
                <p className="text-gray-500 italic">Nu există text extras pentru acest document.</p>
              )}
            </div>
            <div className="px-6 py-3 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => {
                  handleDocAction(previewDoc.id, 'delete');
                  setPreviewDoc(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sterge
              </button>
              <button
                onClick={() => {
                  openReclassifyModal(previewDoc);
                  setPreviewDoc(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reclasifica
              </button>
              <button
                onClick={() => {
                  handleDocAction(previewDoc.id, 'accept');
                  setPreviewDoc(null);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Accepta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reclassify Modal */}
      <ReclassifyModal
        isOpen={isReclassifyModalOpen}
        onClose={() => {
          setIsReclassifyModalOpen(false);
          setReclassifyingDoc(null);
        }}
        onSubmit={handleReclassify}
        document={reclassifyingDoc}
        isLoading={isReclassifying}
      />
    </div>
  );
}
