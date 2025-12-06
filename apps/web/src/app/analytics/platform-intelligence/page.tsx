/**
 * Platform Intelligence Dashboard Page
 * Story 5.7: Platform Intelligence Dashboard - Task 20
 *
 * Comprehensive platform intelligence dashboard with:
 * - Platform health score (AC: 1-6)
 * - Key metrics summary (AC: 1-6)
 * - Tabbed sections for each analytics area
 * - Export functionality
 * - Recommendations panel
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Mail,
  FileCheck,
  ListTodo,
  Brain,
  TrendingUp,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

// Hooks
import {
  usePlatformIntelligenceDashboard,
  useExportDashboard,
  useRefreshDashboard,
  useDateRangePresets,
  type DateRangeInput,
} from '../../../hooks/usePlatformIntelligence';

// Components
import { FinancialData } from '../../../components/auth/FinancialData';
import { DateRangePicker } from '../../../components/analytics/DateRangePicker';
import { PlatformHealthScoreCard } from '../../../components/analytics/PlatformHealthScoreCard';
import { KeyMetricsSummaryRow } from '../../../components/analytics/KeyMetricsSummaryRow';
import { ResponseTimeAnalyticsPanel } from '../../../components/analytics/ResponseTimeAnalyticsPanel';
import { DocumentQualityPanel } from '../../../components/analytics/DocumentQualityPanel';
import { AIUtilizationPanel } from '../../../components/analytics/AIUtilizationPanel';
import { ROIDashboard } from '../../../components/analytics/ROIDashboard';
import { RecommendationsPanel } from '../../../components/analytics/RecommendationsPanel';
import { VelocityTrendsChart } from '../../../components/analytics/VelocityTrendsChart';
import { OverdueAnalysisPanel } from '../../../components/analytics/OverdueAnalysisPanel';
import { CompletionTimeCharts } from '../../../components/analytics/CompletionTimeCharts';

// Types
type PlatformTab = 'overview' | 'communication' | 'quality' | 'tasks' | 'ai' | 'roi';

// ============================================================================
// Tab Configuration
// ============================================================================

const tabs: { id: PlatformTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'overview',
    label: 'Prezentare generală',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    id: 'communication',
    label: 'Comunicare',
    icon: <Mail className="w-4 h-4" />,
  },
  {
    id: 'quality',
    label: 'Calitate documente',
    icon: <FileCheck className="w-4 h-4" />,
  },
  {
    id: 'tasks',
    label: 'Sarcini',
    icon: <ListTodo className="w-4 h-4" />,
  },
  {
    id: 'ai',
    label: 'Utilizare AI',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: 'roi',
    label: 'ROI',
    icon: <TrendingUp className="w-4 h-4" />,
  },
];

// ============================================================================
// Access Denied Component
// ============================================================================

function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Acces restricționat</h2>
      <p className="text-gray-500 max-w-sm mb-6">
        Panoul de Inteligență Platformă este disponibil doar pentru Parteneri și Proprietari de
        firmă.
      </p>
      <button
        onClick={() => router.push('/analytics')}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Înapoi la Analize
      </button>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
      <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-red-800">Eroare la încărcarea datelor</h3>
      <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
      >
        Încearcă din nou
      </button>
    </div>
  );
}

// ============================================================================
// Export Dialog Component (inline for Task 22)
// ============================================================================

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'PDF' | 'EXCEL' | 'CSV') => void;
  loading: boolean;
  exportUrl?: string;
}

function ExportDialog({ isOpen, onClose, onExport, loading, exportUrl }: ExportDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Exportă Raport</h2>

        {exportUrl ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-4">Raportul este gata pentru descărcare</p>
            <a
              href={exportUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Descarcă
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-4">Selectați formatul pentru export:</p>

            <button
              onClick={() => onExport('PDF')}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 font-semibold text-sm">PDF</span>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">PDF Document</div>
                <div className="text-xs text-gray-500">Raport complet formatat</div>
              </div>
            </button>

            <button
              onClick={() => onExport('EXCEL')}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-semibold text-sm">XLS</span>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">Excel Spreadsheet</div>
                <div className="text-xs text-gray-500">Date structurate pentru analiză</div>
              </div>
            </button>

            <button
              onClick={() => onExport('CSV')}
              disabled={loading}
              className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-600 font-semibold text-sm">CSV</span>
              </div>
              <div className="text-left">
                <div className="font-medium text-gray-900">CSV Export</div>
                <div className="text-xs text-gray-500">Date brute pentru import</div>
              </div>
            </button>

            {loading && (
              <div className="text-center py-4 text-sm text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                Se generează raportul...
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Închide
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

function PlatformIntelligenceDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const presets = useDateRangePresets();

  // Date range state
  const [dateRange, setDateRange] = useState<DateRangeInput>(presets.last30Days);

  // Tab derived from URL (URL is source of truth)
  const tabParam = searchParams.get('tab');
  const activeTab: PlatformTab = tabs.find((t) => t.id === tabParam)?.id || 'overview';

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | undefined>();

  // Addressed recommendations state (local storage in production)
  const [addressedRecommendations, setAddressedRecommendations] = useState<number[]>([]);

  // Hooks
  const { data, loading, error, refetch } = usePlatformIntelligenceDashboard(dateRange);
  const { exportDashboard, loading: exportLoading } = useExportDashboard();
  const { refresh, loading: refreshLoading } = useRefreshDashboard();

  // Handle tab change (updates URL, which updates activeTab)
  const handleTabChange = useCallback(
    (tab: PlatformTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const newUrl = params.toString()
        ? `/analytics/platform-intelligence?${params.toString()}`
        : '/analytics/platform-intelligence';
      router.replace(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  // Handle export
  const handleExport = async (format: 'PDF' | 'EXCEL' | 'CSV') => {
    try {
      const result = await exportDashboard(dateRange, format);
      if (result?.url) {
        setExportUrl(result.url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refresh();
    refetch();
  };

  // Handle marking recommendation as addressed
  const handleMarkAsAddressed = (index: number) => {
    setAddressedRecommendations((prev) => [...prev, index]);
  };

  // Date range handler
  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Navigate to section from KeyMetricsSummary
  const handleNavigateToSection = (section: string) => {
    const tabMap: Record<string, PlatformTab> = {
      efficiency: 'overview',
      communication: 'communication',
      quality: 'quality',
      tasks: 'tasks',
      ai: 'ai',
      roi: 'roi',
    };
    const targetTab = tabMap[section] || 'overview';
    handleTabChange(targetTab);
  };

  // Set document title
  useEffect(() => {
    document.title = 'Inteligență Platformă | Analize';
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <nav className="text-sm text-gray-500 mb-1" aria-label="Breadcrumb">
                <a href="/analytics" className="hover:text-gray-700">
                  Analize
                </a>
                <span className="mx-2">/</span>
                <span className="text-gray-900">Inteligență Platformă</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">Inteligență Platformă</h1>
              <p className="text-sm text-gray-500 mt-1">
                Analiză comprehensivă a eficienței și ROI-ului platformei
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Picker */}
              <DateRangePicker
                startDate={dateRange.start}
                endDate={dateRange.end}
                onChange={handleDateRangeChange}
              />

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Reîmprospătare date"
              >
                <RefreshCw className={`w-4 h-4 ${refreshLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Reîmprospătare</span>
              </button>

              {/* Export Button */}
              <button
                onClick={() => {
                  setExportUrl(undefined);
                  setShowExportDialog(true);
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportă</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            className="flex space-x-1 overflow-x-auto pb-px -mb-px"
            aria-label="Platform intelligence sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Platform Health Score - always visible */}
        {activeTab === 'overview' && (
          <div className="mb-8">
            <PlatformHealthScoreCard
              score={data?.platformHealthScore ?? 0}
              loading={loading}
              breakdown={{
                communication:
                  data?.communication?.baselineComparison?.improvementPercent ?? undefined,
                documentQuality: data?.documentQuality?.revisionMetrics?.firstTimeRightPercent,
                taskCompletion: data?.taskCompletion?.completionRate,
                aiAdoption:
                  data?.aiUtilization?.byUser && data.aiUtilization.byUser.length > 0
                    ? data.aiUtilization.byUser.reduce((sum, u) => sum + u.adoptionScore, 0) /
                      data.aiUtilization.byUser.length
                    : undefined,
                roi: undefined, // ROI growth calculated separately
              }}
            />
          </div>
        )}

        {/* Key Metrics Summary - always visible on overview */}
        {activeTab === 'overview' && (
          <div className="mb-8">
            <KeyMetricsSummaryRow
              efficiency={data?.efficiency}
              communication={data?.communication}
              documentQuality={data?.documentQuality}
              taskCompletion={data?.taskCompletion}
              aiUtilization={data?.aiUtilization}
              roi={data?.roi}
              loading={loading}
              onNavigate={handleNavigateToSection}
            />
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-8">
          {/* Overview Tab - Condensed versions of all sections */}
          {activeTab === 'overview' && (
            <>
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Communication Preview */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Comunicare</h2>
                    <button
                      onClick={() => handleTabChange('communication')}
                      className="text-sm text-violet-600 hover:text-violet-700"
                    >
                      Vezi detalii →
                    </button>
                  </div>
                  {loading ? (
                    <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Timp mediu răspuns</span>
                        <span className="font-semibold">
                          {data?.communication?.currentResponseTime?.avgResponseTimeHours?.toFixed(
                            1
                          ) ?? '-'}{' '}
                          ore
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">În SLA (24h)</span>
                        <span className="font-semibold text-green-600">
                          {data?.communication?.currentResponseTime?.withinSLAPercent?.toFixed(0) ??
                            '-'}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Îmbunătățire</span>
                        <span className="font-semibold text-violet-600">
                          {data?.communication?.baselineComparison?.improvementPercent?.toFixed(
                            0
                          ) ?? '-'}
                          %
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document Quality Preview */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Calitate Documente</h2>
                    <button
                      onClick={() => handleTabChange('quality')}
                      className="text-sm text-violet-600 hover:text-violet-700"
                    >
                      Vezi detalii →
                    </button>
                  </div>
                  {loading ? (
                    <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Prima dată corect</span>
                        <span className="font-semibold">
                          {data?.documentQuality?.revisionMetrics?.firstTimeRightPercent?.toFixed(
                            0
                          ) ?? '-'}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Medie revizii</span>
                        <span className="font-semibold">
                          {data?.documentQuality?.revisionMetrics?.avgRevisionsPerDocument?.toFixed(
                            1
                          ) ?? '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Timp rezolvare probleme</span>
                        <span className="font-semibold">
                          {data?.documentQuality?.errorMetrics?.issueResolutionTimeHours?.toFixed(
                            1
                          ) ?? '-'}{' '}
                          ore
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Utilization Preview */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Utilizare AI</h2>
                    <button
                      onClick={() => handleTabChange('ai')}
                      className="text-sm text-violet-600 hover:text-violet-700"
                    >
                      Vezi detalii →
                    </button>
                  </div>
                  {loading ? (
                    <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total cereri</span>
                        <span className="font-semibold">
                          {data?.aiUtilization?.firmTotal?.totalRequests?.toLocaleString() ?? '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Cereri/utilizator</span>
                        <span className="font-semibold">
                          {data?.aiUtilization?.firmTotal?.avgRequestsPerUser?.toFixed(0) ?? '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Utilizatori sub medie</span>
                        <span className="font-semibold text-orange-600">
                          {data?.aiUtilization?.underutilizedUsers?.length ?? '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ROI Preview */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">ROI</h2>
                    <button
                      onClick={() => handleTabChange('roi')}
                      className="text-sm text-violet-600 hover:text-violet-700"
                    >
                      Vezi detalii →
                    </button>
                  </div>
                  {loading ? (
                    <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Valoare economisită</span>
                        <span className="font-semibold text-green-600">
                          {data?.roi?.totalValueSaved?.toLocaleString('ro-RO', {
                            style: 'currency',
                            currency: 'RON',
                            maximumFractionDigits: 0,
                          }) ?? '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Ore facturabile recuperate</span>
                        <span className="font-semibold">
                          {data?.roi?.billableHoursRecovered?.toFixed(0) ?? '-'}h
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Proiecție anuală</span>
                        <span className="font-semibold text-violet-600">
                          {data?.roi?.projectedAnnualSavings?.toLocaleString('ro-RO', {
                            style: 'currency',
                            currency: 'RON',
                            maximumFractionDigits: 0,
                          }) ?? '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendations Panel */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <RecommendationsPanel
                  recommendations={data?.recommendations ?? []}
                  loading={loading}
                  onMarkAsAddressed={handleMarkAsAddressed}
                  addressedRecommendations={addressedRecommendations}
                />
              </div>
            </>
          )}

          {/* Communication Tab (AC: 2) */}
          {activeTab === 'communication' && (
            <ResponseTimeAnalyticsPanel
              data={data?.communication ?? undefined}
              loading={loading}
            />
          )}

          {/* Document Quality Tab (AC: 3) */}
          {activeTab === 'quality' && (
            <DocumentQualityPanel data={data?.documentQuality ?? undefined} loading={loading} />
          )}

          {/* Tasks Tab (AC: 4) */}
          {activeTab === 'tasks' && (
            <div className="space-y-8">
              {/* Task completion metrics from dashboard data */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Finalizare Sarcini</h2>
                {loading ? (
                  <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  <div className="grid md:grid-cols-4 gap-6">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {data?.taskCompletion?.completionRate?.toFixed(0) ?? '-'}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Rată finalizare</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">
                        {data?.taskCompletion?.deadlineAdherence?.toFixed(0) ?? '-'}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Respectare termene</div>
                    </div>
                    <div className="text-center p-4 bg-violet-50 rounded-lg">
                      <div className="text-3xl font-bold text-violet-600">
                        {data?.taskCompletion?.avgCompletionTimeHours?.toFixed(1) ?? '-'}h
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Timp mediu finalizare</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-3xl font-bold text-red-600">
                        {data?.taskCompletion?.overdueCount ?? '-'}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">Sarcini întârziate</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Velocity and Overdue charts - if available */}
              <div className="grid lg:grid-cols-2 gap-8">
                <VelocityTrendsChart dateRange={dateRange} />
                <OverdueAnalysisPanel dateRange={dateRange} />
              </div>

              <CompletionTimeCharts dateRange={dateRange} />
            </div>
          )}

          {/* AI Utilization Tab (AC: 5) */}
          {activeTab === 'ai' && (
            <AIUtilizationPanel data={data?.aiUtilization ?? undefined} loading={loading} />
          )}

          {/* ROI Tab (AC: 6) */}
          {activeTab === 'roi' && (
            <ROIDashboard
              data={{
                totalValueSaved: data?.roi?.totalValueSaved ?? 0,
                billableHoursRecovered: data?.roi?.billableHoursRecovered ?? 0,
                projectedAnnualSavings: data?.roi?.projectedAnnualSavings ?? 0,
                timeSavedHours: data?.efficiency?.totalTimeSavedHours ?? 0,
                savingsByCategory: data?.roi?.savingsByCategory ?? [],
              }}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        loading={exportLoading}
        exportUrl={exportUrl}
      />
    </div>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function PlatformIntelligencePage() {
  return (
    <FinancialData fallback={<AccessDenied />}>
      <PlatformIntelligenceDashboard />
    </FinancialData>
  );
}
