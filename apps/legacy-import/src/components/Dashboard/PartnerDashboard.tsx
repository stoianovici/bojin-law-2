'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileText,
  Folder,
  Shuffle,
  AlertCircle,
} from 'lucide-react';

interface BatchWithProgress {
  id: string;
  monthYear: string;
  assignedTo: string | null;
  documentCount: number;
  categorizedCount: number;
  skippedCount: number;
  assignedAt: string | null;
  completedAt: string | null;
  progressPercent: number;
}

interface AssistantProgress {
  userId: string;
  userName?: string;
  totalBatches: number;
  completedBatches: number;
  totalDocuments: number;
  categorizedDocuments: number;
  skippedDocuments: number;
  progressPercent: number;
}

interface StalledBatchInfo {
  batchId: string;
  monthYear: string;
  assignedTo: string;
  documentCount: number;
  completedCount: number;
  lastActivity: string | null;
  stalledDays: number;
}

interface ReassignmentInfo {
  stalledBatches: StalledBatchInfo[];
  finishedUsers: string[];
  unassignedCount: number;
  totalBatches: number;
}

interface DashboardData {
  session: {
    id: string;
    pstFileName: string;
    status: string;
    totalDocuments: number;
    categorizedCount: number;
    skippedCount: number;
    uploadedBy: string;
    createdAt: string;
    exportedAt: string | null;
  };
  batches: BatchWithProgress[];
  assistantProgress: AssistantProgress[];
  categoryStats: {
    totalCategories: number;
    categoriesWithDocs: number;
    potentialDuplicates: string[][];
  };
}

interface PartnerDashboardProps {
  sessionId: string;
  onManageCategories: () => void;
  onExport: () => void;
}

export function PartnerDashboard({
  sessionId,
  onManageCategories,
  onExport,
}: PartnerDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reassignmentInfo, setReassignmentInfo] = useState<ReassignmentInfo | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignmentMessage, setReassignmentMessage] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/partner-dashboard?sessionId=${sessionId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard');
      }
      const dashboardData = await res.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchReassignmentInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/reassign-batches?sessionId=${sessionId}`);
      if (res.ok) {
        const info = await res.json();
        setReassignmentInfo(info);
      }
    } catch (err) {
      console.error('Error fetching reassignment info:', err);
    }
  }, [sessionId]);

  const handleAutoReassign = useCallback(async () => {
    if (isReassigning) return;

    try {
      setIsReassigning(true);
      setReassignmentMessage(null);

      const res = await fetch('/api/reassign-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        throw new Error('Failed to reassign batches');
      }

      const result = await res.json();
      setReassignmentMessage(result.message);

      // Refresh dashboard and reassignment info
      await Promise.all([fetchDashboard(), fetchReassignmentInfo()]);
    } catch (err) {
      setReassignmentMessage(
        err instanceof Error ? err.message : 'Failed to reassign batches'
      );
    } finally {
      setIsReassigning(false);
    }
  }, [sessionId, isReassigning, fetchDashboard, fetchReassignmentInfo]);

  useEffect(() => {
    fetchDashboard();
    fetchReassignmentInfo();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboard();
      fetchReassignmentInfo();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchReassignmentInfo]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Se încarcă panoul de control...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
        >
          Reîncearcă
        </button>
      </div>
    );
  }

  if (!data) return null;

  const overallProgress =
    data.session.totalDocuments > 0
      ? Math.round(
          ((data.session.categorizedCount + data.session.skippedCount) /
            data.session.totalDocuments) *
            100
        )
      : 0;

  const isReadyForExport =
    data.session.categorizedCount + data.session.skippedCount >=
    data.session.totalDocuments;

  return (
    <div className="space-y-6">
      {/* Header with Session Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Panou de control partener
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {data.session.pstFileName}
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Reîmprospătează"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Overall Progress */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Total documente</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {data.session.totalDocuments}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Categorizate</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {data.session.categorizedCount}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Sărite</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">
              {data.session.skippedCount}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-purple-700 mb-1">
              <Folder className="h-4 w-4" />
              <span className="text-sm font-medium">Categorii</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">
              {data.categoryStats.totalCategories}
            </p>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progres general
            </span>
            <span className="text-sm text-gray-600">{overallProgress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallProgress === 100 ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Duplicate Categories Warning */}
      {data.categoryStats.potentialDuplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-800">
                Categorii duplicate posibile detectate
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {data.categoryStats.potentialDuplicates.length} grupuri de categorii
                similare găsite. Verifică și unește înainte de export.
              </p>
              <button
                onClick={onManageCategories}
                className="mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-sm font-medium"
              >
                Administrare categorii
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stalled Batches Warning */}
      {reassignmentInfo && reassignmentInfo.stalledBatches.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800">
                Loturi blocate detectate
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {reassignmentInfo.stalledBatches.length} lot(uri) nu au avut activitate
                de peste 24 de ore. Consideră reatribuirea către asistenți activi.
              </p>
              <div className="mt-3 space-y-2">
                {reassignmentInfo.stalledBatches.slice(0, 3).map((batch) => (
                  <div
                    key={batch.batchId}
                    className="text-xs text-red-700 bg-red-100 rounded px-2 py-1"
                  >
                    {formatMonthYear(batch.monthYear)} - {batch.completedCount}/
                    {batch.documentCount} finalizat - Blocat {batch.stalledDays} zi(le)
                  </div>
                ))}
                {reassignmentInfo.stalledBatches.length > 3 && (
                  <p className="text-xs text-red-600">
                    ...și încă {reassignmentInfo.stalledBatches.length - 3}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={handleAutoReassign}
                  disabled={isReassigning}
                  className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {isReassigning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  Reatribuire automată loturi
                </button>
                {reassignmentMessage && (
                  <span className="text-sm text-red-700">{reassignmentMessage}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finished Users with Available Batches */}
      {reassignmentInfo &&
        reassignmentInfo.finishedUsers.length > 0 &&
        reassignmentInfo.unassignedCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shuffle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-800">
                  Pregătit pentru mai multă muncă
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  {reassignmentInfo.finishedUsers.length} asistent(i) au
                  finalizat loturile lor. {reassignmentInfo.unassignedCount}{' '}
                  lot(uri) neatribuite disponibile.
                </p>
                <button
                  onClick={handleAutoReassign}
                  disabled={isReassigning}
                  className="mt-3 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {isReassigning ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  Atribuie mai multe loturi
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Assistant Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Progres asistenți
        </h3>

        {data.assistantProgress.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            Niciun asistent nu a revendicat loturi încă.
          </p>
        ) : (
          <div className="space-y-4">
            {data.assistantProgress.map((assistant) => (
              <div
                key={assistant.userId}
                className="border border-gray-100 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-900">
                      {assistant.userName || `Utilizator ${assistant.userId.slice(0, 8)}`}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({assistant.completedBatches}/{assistant.totalBatches} loturi)
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      assistant.progressPercent === 100
                        ? 'text-green-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {assistant.progressPercent}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      assistant.progressPercent === 100
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${assistant.progressPercent}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>
                    {assistant.categorizedDocuments} categorizate
                  </span>
                  <span>{assistant.skippedDocuments} sărite</span>
                  <span>
                    {assistant.totalDocuments -
                      assistant.categorizedDocuments -
                      assistant.skippedDocuments}{' '}
                    rămase
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Batches by Month */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Loturi pe luni
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">
                  Luna
                </th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">
                  Atribuit la
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">
                  Documente
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">
                  Progres
                </th>
                <th className="text-center py-2 px-3 font-medium text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.batches.map((batch) => {
                const isComplete = batch.progressPercent === 100;
                const isAssigned = batch.assignedTo !== null;

                return (
                  <tr
                    key={batch.id}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-3 px-3">
                      <span className="font-medium text-gray-900">
                        {formatMonthYear(batch.monthYear)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {batch.assignedTo ? (
                        <span className="text-gray-700">
                          Utilizator {batch.assignedTo.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Neatribuit</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-gray-700">{batch.documentCount}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isComplete ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${batch.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">
                          {batch.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle className="h-3 w-3" />
                          Complet
                        </span>
                      ) : isAssigned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <Clock className="h-3 w-3" />
                          În progres
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          În așteptare
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <button
          onClick={onManageCategories}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Administrare categorii
        </button>
        <button
          onClick={onExport}
          disabled={!isReadyForExport}
          className={`px-6 py-3 rounded-lg font-medium ${
            isReadyForExport
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isReadyForExport ? 'Exportă în OneDrive' : 'Finalizează mai întâi categorizarea'}
        </button>
      </div>
    </div>
  );
}

function formatMonthYear(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}
