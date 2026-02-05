'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Merge,
  Eye,
  List,
  Trash2,
  RefreshCw,
  EyeOff,
} from 'lucide-react';
import { ClusterDocumentBrowser } from './ClusterDocumentBrowser';

// ============================================================================
// Types
// ============================================================================

type TriageStatus = 'FirmDrafted' | 'ThirdParty' | 'Irrelevant' | 'CourtDoc' | 'Uncertain';

interface SampleDocument {
  id: string;
  fileName: string;
  fileExtension: string;
  textPreview: string | null;
  emailSubject: string | null;
  hasFile: boolean;
  // Classification fields
  triageStatus: TriageStatus | null;
  triageConfidence: number | null;
  triageReason: string | null;
  suggestedDocType: string | null;
}

interface DocumentValidationCounts {
  accepted: number;
  deleted: number;
  reclassified: number;
  pending: number;
}

interface Cluster {
  id: string;
  suggestedName: string;
  suggestedNameEn: string;
  description: string | null;
  documentCount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Deleted';
  approvedName: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  validatorName: string | null;
  sampleDocuments: SampleDocument[];
  validationCounts?: DocumentValidationCounts;
}

interface ReclusterProgress {
  current: number;
  total: number;
  message?: string;
}

interface ReclusterStatus {
  status: 'idle' | 'processing' | 'completed' | 'error';
  canTrigger: boolean;
  progress?: ReclusterProgress;
  message?: string;
}

interface ClusterStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalDocuments: number;
}

interface ClusterValidationProps {
  sessionId: string;
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

function getTriageStatusDisplay(status: TriageStatus | null) {
  if (!status) return null;
  return TRIAGE_STATUS_CONFIG[status] || null;
}

// ============================================================================
// Component
// ============================================================================

export function ClusterValidation({ sessionId, onUpdate }: ClusterValidationProps) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SampleDocument | null>(null);
  const [previewFullText, setPreviewFullText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [browsingCluster, setBrowsingCluster] = useState<Cluster | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [reclusterStatus, setReclusterStatus] = useState<ReclusterStatus>({
    status: 'idle',
    canTrigger: false,
  });
  const [reclusterLoading, setReclusterLoading] = useState(false);
  const reclusterPollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch clusters
  const fetchClusters = useCallback(async () => {
    try {
      let url =
        filter === 'all'
          ? `/api/clusters?sessionId=${sessionId}`
          : `/api/clusters?sessionId=${sessionId}&status=${filter}`;
      if (showDeleted) {
        url += '&includeDeleted=true';
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch clusters');
      const data = await res.json();
      setClusters(data.clusters);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching clusters:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, filter, showDeleted]);

  // Fetch recluster status
  const fetchReclusterStatus = useCallback(async () => {
    if (!sessionId) return null;
    try {
      const res = await fetch(`/api/recluster?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch recluster status');
      const data = await res.json();
      setReclusterStatus(data);
      return data;
    } catch (err) {
      console.error('Error fetching recluster status:', err);
      return null;
    }
  }, [sessionId]);

  // Poll recluster status when processing
  useEffect(() => {
    if (!sessionId) return;

    const startPolling = async () => {
      const status = await fetchReclusterStatus();
      if (status?.status === 'processing') {
        reclusterPollRef.current = setInterval(async () => {
          const newStatus = await fetchReclusterStatus();
          if (newStatus?.status !== 'processing') {
            if (reclusterPollRef.current) {
              clearInterval(reclusterPollRef.current);
              reclusterPollRef.current = null;
            }
            // Refresh clusters when recluster completes
            if (newStatus?.status === 'completed') {
              fetchClusters();
              onUpdate();
            }
          }
        }, 5000);
      }
    };

    startPolling();

    return () => {
      if (reclusterPollRef.current) {
        clearInterval(reclusterPollRef.current);
        reclusterPollRef.current = null;
      }
    };
  }, [sessionId, fetchReclusterStatus, fetchClusters, onUpdate]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  // Trigger re-clustering
  const handleTriggerRecluster = async () => {
    setReclusterLoading(true);
    try {
      const res = await fetch('/api/recluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) throw new Error('Failed to trigger recluster');

      // Start polling
      setReclusterStatus((prev) => ({ ...prev, status: 'processing' }));
      reclusterPollRef.current = setInterval(async () => {
        const newStatus = await fetchReclusterStatus();
        if (newStatus?.status !== 'processing') {
          if (reclusterPollRef.current) {
            clearInterval(reclusterPollRef.current);
            reclusterPollRef.current = null;
          }
          if (newStatus?.status === 'completed') {
            fetchClusters();
            onUpdate();
          }
        }
      }, 5000);
    } catch (err) {
      console.error('Error triggering recluster:', err);
    } finally {
      setReclusterLoading(false);
    }
  };

  // Handle cluster actions (approve/reject/delete)
  const handleAction = async (clusterId: string, action: 'approve' | 'reject' | 'delete') => {
    setActionLoading(clusterId);
    try {
      const res = await fetch('/api/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, action }),
      });

      if (!res.ok) throw new Error('Failed to update cluster');

      // Refresh clusters and stats from server
      await fetchClusters();

      // Refresh recluster status after action
      await fetchReclusterStatus();

      onUpdate();
    } catch (err) {
      console.error('Error updating cluster:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle merge
  const handleMerge = async () => {
    if (selectedClusters.size < 2 || !mergeName) return;

    setIsMerging(true);
    try {
      const res = await fetch('/api/clusters/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterIds: Array.from(selectedClusters),
          newName: mergeName,
        }),
      });

      if (!res.ok) throw new Error('Failed to merge clusters');

      // Refresh and reset
      setSelectedClusters(new Set());
      setMergeName('');
      setMergeModalOpen(false);
      fetchClusters();
      onUpdate();
    } catch (err) {
      console.error('Error merging clusters:', err);
    } finally {
      setIsMerging(false);
    }
  };

  // Open document preview and fetch full text
  const openDocumentPreview = async (doc: SampleDocument) => {
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
      console.error('Failed to fetch document text:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Close document preview
  const closeDocumentPreview = () => {
    setPreviewDoc(null);
    setPreviewFullText(null);
  };

  // Toggle cluster selection for merge
  const toggleClusterSelection = (clusterId: string) => {
    setSelectedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
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
      {/* Re-clustering Status Banner */}
      {reclusterStatus.status === 'processing' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <p className="font-medium text-blue-700">Se regrupează documentele...</p>
              {reclusterStatus.progress && (
                <div className="mt-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          reclusterStatus.progress.total > 0
                            ? Math.round(
                                (reclusterStatus.progress.current /
                                  reclusterStatus.progress.total) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    {reclusterStatus.progress.current} / {reclusterStatus.progress.total} documente
                    {reclusterStatus.progress.message && (
                      <span className="ml-2">— {reclusterStatus.progress.message}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {reclusterStatus.canTrigger && reclusterStatus.status !== 'processing' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              <p className="font-medium text-amber-700">Regrupare pregătită</p>
            </div>
            <button
              onClick={handleTriggerRecluster}
              disabled={reclusterLoading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {reclusterLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Pornește re-gruparea
            </button>
          </div>
        </div>
      )}

      {reclusterStatus.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="font-medium text-green-700">Regruparea s-a încheiat</p>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-gray-500">Total grupuri:</span>{' '}
                <span className="font-medium">{stats.total}</span>
              </div>
              <div>
                <span className="text-gray-500">De validat:</span>{' '}
                <span className="font-medium text-amber-600">{stats.pending}</span>
              </div>
              <div>
                <span className="text-gray-500">Aprobate:</span>{' '}
                <span className="font-medium text-green-600">{stats.approved}</span>
              </div>
              <div>
                <span className="text-gray-500">Respinse:</span>{' '}
                <span className="font-medium text-red-600">{stats.rejected}</span>
              </div>
              <div>
                <span className="text-gray-500">Total documente:</span>{' '}
                <span className="font-medium">{stats.totalDocuments}</span>
              </div>
            </div>

            {/* Filter and Show Deleted Toggle */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="h-4 w-4 text-gray-600 rounded border-gray-300"
                />
                <EyeOff className="h-4 w-4" />
                Arată șterse
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value="all">Toate</option>
                <option value="Pending">De validat</option>
                <option value="Approved">Aprobate</option>
                <option value="Rejected">Respinse</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Merge Action Bar */}
      {selectedClusters.size >= 2 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <Merge className="h-5 w-5" />
            <span className="font-medium">
              {selectedClusters.size} grupuri selectate pentru unificare
            </span>
          </div>
          <button
            onClick={() => setMergeModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Unifică grupurile
          </button>
        </div>
      )}

      {/* Cluster List */}
      <div className="space-y-3">
        {clusters.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              {filter === 'Pending' ? 'Niciun grup de validat!' : 'Niciun grup găsit.'}
            </p>
          </div>
        ) : (
          clusters.map((cluster) => (
            <div
              key={cluster.id}
              className={`bg-white rounded-lg border ${
                selectedClusters.has(cluster.id)
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() =>
                  setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)
                }
              >
                <div className="flex items-center gap-3">
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedClusters.has(cluster.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleClusterSelection(cluster.id);
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                  />

                  {/* Status icon */}
                  {cluster.status === 'Approved' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {cluster.status === 'Rejected' && <XCircle className="h-5 w-5 text-red-500" />}
                  {cluster.status === 'Deleted' && <Trash2 className="h-5 w-5 text-gray-400" />}
                  {cluster.status === 'Pending' && (
                    <div className="h-5 w-5 rounded-full border-2 border-amber-400" />
                  )}

                  {/* Name */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-medium ${cluster.status === 'Deleted' ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                      >
                        {cluster.approvedName || cluster.suggestedName}
                      </h3>
                      {/* Validator badge */}
                      {cluster.validatorName && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {cluster.status === 'Approved'
                            ? 'Aprobat'
                            : cluster.status === 'Deleted'
                              ? 'Șters'
                              : 'Respins'}{' '}
                          de {cluster.validatorName}
                        </span>
                      )}
                    </div>
                    {cluster.suggestedNameEn && (
                      <p
                        className={`text-sm ${cluster.status === 'Deleted' ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        {cluster.suggestedNameEn}
                      </p>
                    )}
                    {/* Validation progress counters */}
                    {cluster.validationCounts && (
                      <p className="text-xs text-gray-500 mt-1">
                        {cluster.validationCounts.accepted > 0 && (
                          <span className="text-green-600">
                            {cluster.validationCounts.accepted} acceptate
                          </span>
                        )}
                        {cluster.validationCounts.accepted > 0 &&
                          cluster.validationCounts.deleted > 0 &&
                          ' · '}
                        {cluster.validationCounts.deleted > 0 && (
                          <span className="text-red-600">
                            {cluster.validationCounts.deleted} șterse
                          </span>
                        )}
                        {(cluster.validationCounts.accepted > 0 ||
                          cluster.validationCounts.deleted > 0) &&
                          cluster.validationCounts.reclassified > 0 &&
                          ' · '}
                        {cluster.validationCounts.reclassified > 0 && (
                          <span className="text-blue-600">
                            {cluster.validationCounts.reclassified} reclasificate
                          </span>
                        )}
                        {(cluster.validationCounts.accepted > 0 ||
                          cluster.validationCounts.deleted > 0 ||
                          cluster.validationCounts.reclassified > 0) &&
                          cluster.validationCounts.pending > 0 &&
                          ' · '}
                        {cluster.validationCounts.pending > 0 && (
                          <span className="text-amber-600">
                            {cluster.validationCounts.pending} în așteptare
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Document count */}
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <FileText className="h-4 w-4" />
                    <span>{cluster.documentCount}</span>
                  </div>

                  {/* Cluster Actions */}
                  {cluster.status === 'Pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(cluster.id, 'approve');
                        }}
                        disabled={actionLoading === cluster.id}
                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading === cluster.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Aprobă
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(cluster.id, 'reject');
                        }}
                        disabled={actionLoading === cluster.id}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading === cluster.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            Respinge
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(cluster.id, 'delete');
                        }}
                        disabled={actionLoading === cluster.id}
                        className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading === cluster.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Șterge
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Expand icon */}
                  {expandedCluster === cluster.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {expandedCluster === cluster.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {cluster.description && (
                    <p className="text-sm text-gray-600 mb-4">{cluster.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Exemple de documente ({cluster.sampleDocuments.length} din{' '}
                      {cluster.documentCount})
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBrowsingCluster(cluster);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium"
                    >
                      <List className="h-4 w-4" />
                      Vezi toate documentele
                    </button>
                  </div>

                  <div className="space-y-3">
                    {cluster.sampleDocuments.map((doc) => {
                      const statusDisplay = getTriageStatusDisplay(doc.triageStatus);
                      return (
                        <div key={doc.id} className="bg-white rounded border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {doc.fileName}
                              </span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {doc.fileExtension}
                              </span>
                              {/* Classification badge */}
                              {statusDisplay && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${statusDisplay.bg} ${statusDisplay.color}`}
                                >
                                  {statusDisplay.label}
                                  {doc.triageConfidence !== null && (
                                    <span className="ml-1 opacity-75">
                                      ({Math.round(doc.triageConfidence * 100)}%)
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {doc.hasFile && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDocumentPreview(doc);
                                }}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                              >
                                <Eye className="h-3 w-3" />
                                Vizualizează
                              </button>
                            )}
                          </div>
                          {/* Suggested doc type */}
                          {doc.suggestedDocType && (
                            <p className="text-xs text-gray-500 mb-1">
                              Tip sugerat:{' '}
                              <span className="font-medium">{doc.suggestedDocType}</span>
                            </p>
                          )}
                          {doc.emailSubject && (
                            <p className="text-xs text-gray-500 mb-2">
                              Subiect: {doc.emailSubject}
                            </p>
                          )}
                          {doc.textPreview && (
                            <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">
                              {doc.textPreview}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Merge Modal */}
      {mergeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unifică {selectedClusters.size} grupuri
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numele noului grup
              </label>
              <input
                type="text"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                placeholder="ex: Contracte de vânzare-cumpărare"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMergeModalOpen(false);
                  setMergeName('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
              >
                Anulează
              </button>
              <button
                onClick={handleMerge}
                disabled={!mergeName || isMerging}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unifică'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={closeDocumentPreview}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-6xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <div>
                  <h3 className="font-medium text-gray-900">{previewDoc.fileName}</h3>
                  {previewDoc.emailSubject && (
                    <p className="text-sm text-gray-500">Subiect: {previewDoc.emailSubject}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {previewDoc.fileExtension}
                </span>
                {/* Classification badge in modal */}
                {(() => {
                  const statusDisplay = getTriageStatusDisplay(previewDoc.triageStatus);
                  return statusDisplay ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${statusDisplay.bg} ${statusDisplay.color}`}
                    >
                      {statusDisplay.label}
                      {previewDoc.triageConfidence !== null && (
                        <span className="ml-1 opacity-75">
                          ({Math.round(previewDoc.triageConfidence * 100)}%)
                        </span>
                      )}
                    </span>
                  ) : null;
                })()}
                {previewDoc.suggestedDocType && (
                  <span className="text-xs text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                    {previewDoc.suggestedDocType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/document-proxy?documentId=${previewDoc.id}`}
                  download={previewDoc.fileName}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Descarcă
                </a>
                <button
                  onClick={closeDocumentPreview}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Închide
                </button>
              </div>
            </div>
            {/* Classification reason */}
            {previewDoc.triageReason && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Motiv clasificare:</span> {previewDoc.triageReason}
                </p>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {previewDoc.fileExtension.toLowerCase() === 'pdf' ? (
                <iframe
                  src={`/api/document-proxy?documentId=${previewDoc.id}`}
                  className="w-full h-full"
                  title={previewDoc.fileName}
                />
              ) : previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="h-full overflow-auto p-6">
                  {previewFullText || previewDoc.textPreview ? (
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                      {previewFullText || previewDoc.textPreview}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <FileText className="h-16 w-16 mb-4 text-gray-300" />
                      <p className="text-lg font-medium mb-2">Previzualizare indisponibilă</p>
                      <p className="text-sm mb-4">
                        Acest tip de fișier ({previewDoc.fileExtension}) nu poate fi previzualizat
                        direct.
                      </p>
                      <a
                        href={`/api/document-proxy?documentId=${previewDoc.id}`}
                        download={previewDoc.fileName}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Descarcă fișierul
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cluster Document Browser Modal */}
      {browsingCluster && (
        <ClusterDocumentBrowser
          clusterId={browsingCluster.id}
          clusterName={browsingCluster.approvedName || browsingCluster.suggestedName}
          onClose={() => setBrowsingCluster(null)}
          onUpdate={() => {
            fetchClusters();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
