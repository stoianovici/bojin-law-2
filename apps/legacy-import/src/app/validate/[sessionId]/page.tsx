'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FolderOpen,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { ClusterValidation } from '@/components/Validation/ClusterValidation';
import { UncertainDocsReview } from '@/components/Validation/UncertainDocsReview';
import { PipelineProgress } from '@/components/Validation/PipelineProgress';

// ============================================================================
// Types
// ============================================================================

type ValidationTab = 'pipeline' | 'clusters' | 'uncertain';

interface PipelineStatus {
  sessionId: string;
  pstFileName: string;
  totalDocuments: number;
  pipeline: {
    status: string;
    progress: number;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  };
  triage: {
    stats: Record<string, number> | null;
    byStatus: Record<string, number>;
  };
  deduplication: {
    stats: Record<string, number> | null;
  };
  clustering: {
    stats: Record<string, number> | null;
    byStatus: Record<string, number>;
  };
}

// ============================================================================
// Main Component
// ============================================================================

export default function ValidatePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [activeTab, setActiveTab] = useState<ValidationTab>('pipeline');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pipeline status
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline?sessionId=${sessionId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch pipeline status');
      }
      const data = await res.json();
      setPipelineStatus(data);

      // Auto-switch to clusters tab when ready for validation
      if (data.pipeline.status === 'ReadyForValidation' || data.pipeline.status === 'Completed') {
        setActiveTab('clusters');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPipelineStatus();

    // Poll for updates while pipeline is running
    const interval = setInterval(() => {
      if (
        pipelineStatus?.pipeline.status &&
        !['ReadyForValidation', 'Completed', 'Failed', 'NotStarted'].includes(
          pipelineStatus.pipeline.status
        )
      ) {
        fetchPipelineStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPipelineStatus, pipelineStatus?.pipeline.status]);

  // Calculate stats
  const uncertainCount = pipelineStatus?.triage?.byStatus?.Uncertain || 0;
  const pendingClusters = pipelineStatus?.clustering?.byStatus?.Pending || 0;
  const approvedClusters = pipelineStatus?.clustering?.byStatus?.Approved || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Se încarcă...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              fetchPipelineStatus();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Validare Categorizare AI</h1>
              <p className="text-sm text-gray-500">
                {pipelineStatus?.pstFileName} - {pipelineStatus?.totalDocuments.toLocaleString()}{' '}
                documente
              </p>
            </div>
            <button
              onClick={fetchPipelineStatus}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizează
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'pipeline'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Progres Pipeline
              </div>
            </button>

            <button
              onClick={() => setActiveTab('clusters')}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'clusters'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Grupuri de documente
                {pendingClusters > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                    {pendingClusters}
                  </span>
                )}
                {approvedClusters > 0 && pendingClusters === 0 && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('uncertain')}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === 'uncertain'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Documente incerte
                {uncertainCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                    {uncertainCount}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'pipeline' && pipelineStatus && (
          <PipelineProgress status={pipelineStatus} onRefresh={fetchPipelineStatus} />
        )}

        {activeTab === 'clusters' && (
          <ClusterValidation sessionId={sessionId} onUpdate={fetchPipelineStatus} />
        )}

        {activeTab === 'uncertain' && (
          <UncertainDocsReview sessionId={sessionId} onUpdate={fetchPipelineStatus} />
        )}
      </div>
    </div>
  );
}
