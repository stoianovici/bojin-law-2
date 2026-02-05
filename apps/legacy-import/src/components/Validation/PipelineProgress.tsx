'use client';

import { CheckCircle, XCircle, Loader2, Clock, FileText, Hash, Layers, Tag } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

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

interface PipelineProgressProps {
  status: PipelineStatus;
  onRefresh?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PipelineProgress({ status, onRefresh: _onRefresh }: PipelineProgressProps) {
  const pipelineStages = [
    {
      id: 'Triaging',
      label: 'Triaj documente',
      description: 'Clasificare FirmDrafted/ThirdParty/Irrelevant',
      icon: FileText,
    },
    {
      id: 'Deduplicating',
      label: 'Deduplicare',
      description: 'Identificare și grupare duplicate',
      icon: Hash,
    },
    {
      id: 'Embedding',
      label: 'Generare embeddings',
      description: 'Vectorizare cu Voyage AI',
      icon: Layers,
    },
    {
      id: 'Clustering',
      label: 'Grupare',
      description: 'Clustering UMAP + OPTICS',
      icon: Layers,
    },
    {
      id: 'Naming',
      label: 'Denumire grupuri',
      description: 'Sugestii de nume cu AI',
      icon: Tag,
    },
    {
      id: 'ReadyForValidation',
      label: 'Gata pentru validare',
      description: 'Pipeline complet',
      icon: CheckCircle,
    },
  ];

  const currentStageIndex = pipelineStages.findIndex((s) => s.id === status.pipeline.status);

  const getStageStatus = (index: number) => {
    if (status.pipeline.status === 'Failed') {
      return index <= currentStageIndex ? 'failed' : 'pending';
    }
    if (index < currentStageIndex) return 'complete';
    if (index === currentStageIndex) return 'current';
    return 'pending';
  };

  const formatDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {status.pipeline.status === 'Failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Pipeline eșuat</h3>
              <p className="text-sm text-red-600 mt-1">{status.pipeline.error}</p>
              <p className="text-xs text-red-500 mt-2">
                Rulează din nou pipeline-ul după rezolvarea problemei.
              </p>
            </div>
          </div>
        </div>
      )}

      {status.pipeline.status === 'ReadyForValidation' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-800">Pipeline finalizat cu succes!</h3>
              <p className="text-sm text-green-600 mt-1">
                Documentele sunt gata pentru validare. Mergi la tab-ul &quot;Grupuri de
                documente&quot; pentru a valida categorizarea.
              </p>
            </div>
          </div>
        </div>
      )}

      {status.pipeline.status === 'NotStarted' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-800">Pipeline neînceput</h3>
              <p className="text-sm text-gray-600 mt-1">
                Rulează scriptul de pipeline pentru a începe categorizarea AI:
              </p>
              <code className="block mt-2 bg-gray-100 px-3 py-2 rounded text-xs text-gray-700">
                npx ts-node src/scripts/run-pipeline.ts --session={status.sessionId}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-6">Etapele Pipeline-ului</h2>

        <div className="space-y-4">
          {pipelineStages.map((stage, index) => {
            const stageStatus = getStageStatus(index);
            const Icon = stage.icon;

            return (
              <div key={stage.id} className="flex items-start gap-4">
                {/* Status Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    stageStatus === 'complete'
                      ? 'bg-green-100'
                      : stageStatus === 'current'
                        ? 'bg-blue-100'
                        : stageStatus === 'failed'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                  }`}
                >
                  {stageStatus === 'complete' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {stageStatus === 'current' && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  )}
                  {stageStatus === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
                  {stageStatus === 'pending' && <Icon className="h-5 w-5 text-gray-400" />}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        stageStatus === 'complete'
                          ? 'text-green-700'
                          : stageStatus === 'current'
                            ? 'text-blue-700'
                            : stageStatus === 'failed'
                              ? 'text-red-700'
                              : 'text-gray-500'
                      }`}
                    >
                      {stage.label}
                    </span>
                    {stageStatus === 'current' && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        În desfășurare...
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{stage.description}</p>
                </div>

                {/* Connector Line */}
                {index < pipelineStages.length - 1 && (
                  <div className="absolute left-4 mt-8 w-0.5 h-8 bg-gray-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Triage Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Rezultate Triaj</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">FirmDrafted</span>
              <span className="font-medium text-green-600">
                {status.triage.byStatus.FirmDrafted || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ThirdParty</span>
              <span className="font-medium text-blue-600">
                {status.triage.byStatus.ThirdParty || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">CourtDoc</span>
              <span className="font-medium text-purple-600">
                {status.triage.byStatus.CourtDoc || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Irrelevant</span>
              <span className="font-medium text-gray-600">
                {status.triage.byStatus.Irrelevant || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uncertain</span>
              <span className="font-medium text-amber-600">
                {status.triage.byStatus.Uncertain || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Dedup Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Deduplicare</h3>
          {status.deduplication.stats ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total documente</span>
                <span className="font-medium">
                  {(status.deduplication.stats as any).total || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unice</span>
                <span className="font-medium text-green-600">
                  {(status.deduplication.stats as any).unique || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duplicate</span>
                <span className="font-medium text-amber-600">
                  {(status.deduplication.stats as any).duplicates || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Grupuri</span>
                <span className="font-medium text-blue-600">
                  {(status.deduplication.stats as any).groups || 0}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nicio dată încă</p>
          )}
        </div>

        {/* Clustering Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Grupare</h3>
          {status.clustering.stats ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total grupuri</span>
                <span className="font-medium">
                  {(status.clustering.stats as any).clusterCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dimensiune medie</span>
                <span className="font-medium">
                  {(status.clustering.stats as any).averageClusterSize || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cel mai mare</span>
                <span className="font-medium">
                  {(status.clustering.stats as any).largestCluster || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Neclasificate</span>
                <span className="font-medium text-amber-600">
                  {(status.clustering.stats as any).noiseCount || 0}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nicio dată încă</p>
          )}
        </div>
      </div>

      {/* Duration */}
      {status.pipeline.startedAt && (
        <div className="text-center text-sm text-gray-500">
          Durată: {formatDuration(status.pipeline.startedAt, status.pipeline.completedAt)}
        </div>
      )}
    </div>
  );
}
