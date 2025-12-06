'use client';

/**
 * Document Intelligence Dashboard Page
 * Story 3.7: AI Document Intelligence Dashboard
 *
 * Displays comprehensive analytics for AI-assisted document creation:
 * - Document velocity by user/type
 * - AI utilization rates and adoption trends
 * - Error detection and resolution statistics
 * - Time savings calculations
 * - Template and clause usage
 * - Document quality trends
 */

import { useState, useMemo } from 'react';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { useAnalyticsFiltersStore } from '@/stores/analyticsFiltersStore';
import { useDocumentIntelligenceDashboard } from '@/hooks/useDocumentIntelligence';
import type { DocumentIntelligenceDashboard } from '@legal-platform/types';

// Import widgets
import { DocumentVelocityWidget } from './widgets/DocumentVelocityWidget';
import { AIUtilizationWidget } from './widgets/AIUtilizationWidget';
import { ErrorDetectionWidget } from './widgets/ErrorDetectionWidget';
import { TimeSavingsWidget } from './widgets/TimeSavingsWidget';
import { TemplateUsageWidget } from './widgets/TemplateUsageWidget';
import { QualityTrendsWidget } from './widgets/QualityTrendsWidget';

// Export data to CSV
function exportToCSV(data: DocumentIntelligenceDashboard) {
  const rows: string[] = [];

  // Header
  rows.push('Document Intelligence Dashboard Export');
  rows.push(`Generated: ${new Date().toISOString()}`);
  rows.push('');

  // Velocity Summary
  rows.push('--- Document Velocity ---');
  rows.push(`Total Documents,${data.velocity.totalDocuments}`);
  rows.push(`Average Per Day,${data.velocity.averagePerDay.toFixed(2)}`);
  rows.push(`Trend,${data.velocity.trendPercentage.toFixed(1)}%`);
  rows.push('');

  // AI Utilization
  rows.push('--- AI Utilization ---');
  rows.push(`Overall Utilization Rate,${data.aiUtilization.overallUtilizationRate.toFixed(1)}%`);
  rows.push(`AI-Assisted Documents,${data.aiUtilization.totalAIAssistedDocuments}`);
  rows.push(`Manual Documents,${data.aiUtilization.totalManualDocuments}`);
  rows.push('');

  // Error Detection
  rows.push('--- Error Detection ---');
  rows.push(`Total Concerns Detected,${data.errorDetection.totalConcernsDetected}`);
  rows.push(`Concerns Resolved,${data.errorDetection.concernsResolvedBeforeFiling}`);
  rows.push(`Detection Rate,${data.errorDetection.detectionRate.toFixed(1)}%`);
  rows.push('');

  // Time Savings
  rows.push('--- Time Savings ---');
  rows.push(`Total Minutes Saved,${data.timeSavings.totalMinutesSaved}`);
  rows.push(`Estimated Cost Savings (RON),${data.timeSavings.estimatedCostSavings}`);
  rows.push('');

  // Template Usage
  rows.push('--- Template Usage ---');
  rows.push(`Total Template Usage,${data.templateUsage.totalTemplateUsage}`);
  rows.push(`Template Adoption Rate,${data.templateUsage.templateAdoptionRate.toFixed(1)}%`);
  rows.push('');

  // Quality
  rows.push('--- Quality Trends ---');
  rows.push(`Overall Quality Score,${data.qualityTrends.overallQualityScore.toFixed(1)}`);
  rows.push(`Average Revision Count,${data.qualityTrends.averageRevisionCount.toFixed(1)}`);

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `document-intelligence-${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
}

// Loading skeleton for widgets
function WidgetSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-6"></div>
      <div className="space-y-3">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
      <div className="h-32 bg-gray-200 rounded mt-6"></div>
    </div>
  );
}

// KPI card skeleton
function KPISkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
    </div>
  );
}

// Error state component
function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <h3 className="text-red-800 font-semibold mb-2">Eroare la incarcarea datelor</h3>
      <p className="text-red-600 text-sm mb-4">{error.message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
      >
        Reincearca
      </button>
    </div>
  );
}

export default function DocumentIntelligencePage() {
  const { user } = useAuth();
  const { dateRange } = useAnalyticsFiltersStore();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // Default date range if not set (last 30 days)
  const effectiveDateRange = useMemo(() => {
    if (dateRange) {
      return {
        startDate: dateRange.start,
        endDate: dateRange.end,
      };
    }
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Fetch dashboard data using the React Query hook
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useDocumentIntelligenceDashboard({
    filters: {
      dateRange: effectiveDateRange,
      compareWithPrevious: true,
    },
    // Skip if not authorized
    skip: !user || !['Partner', 'BusinessOwner', 'Admin'].includes(user.role),
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    await refetch();
    setIsManualRefreshing(false);
  };

  // Handle export
  const handleExport = () => {
    if (dashboardData) {
      exportToCSV(dashboardData);
    }
  };

  // Check authorization
  if (!user || !['Partner', 'BusinessOwner', 'Admin'].includes(user.role)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Acces Interzis</h2>
          <p className="text-red-600 text-sm">
            Aceasta pagina este disponibila doar pentru Parteneri, Business Owners si Administratori.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Intelligence Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Analiza comprehensiva a performantei documentelor generate cu AI
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateRangePicker />

          <button
            onClick={handleRefresh}
            disabled={isLoading || isManualRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Reimprospatare date"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isManualRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={!dashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !dashboardData ? (
          <>
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Documente Totale</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.velocity.totalDocuments}</p>
              <p className={`text-sm mt-1 ${dashboardData.velocity.trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardData.velocity.trendPercentage >= 0 ? '+' : ''}{dashboardData.velocity.trendPercentage.toFixed(1)}% vs perioada anterioara
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Rata Utilizare AI</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.aiUtilization.overallUtilizationRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {dashboardData.aiUtilization.totalAIAssistedDocuments} din {dashboardData.aiUtilization.totalAIAssistedDocuments + dashboardData.aiUtilization.totalManualDocuments} documente
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Timp Economisit</p>
              <p className="text-2xl font-bold text-gray-900">{Math.round(dashboardData.timeSavings.totalMinutesSaved / 60)}h</p>
              <p className="text-sm text-green-600 mt-1">
                ~{dashboardData.timeSavings.estimatedCostSavings.toLocaleString('ro-RO')} RON economii
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Scor Calitate</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.qualityTrends.overallQualityScore.toFixed(0)}/100</p>
              <p className="text-sm text-gray-500 mt-1">
                {dashboardData.qualityTrends.averageRevisionCount.toFixed(1)} revizii medii
              </p>
            </div>
          </>
        )}
      </div>

      {/* First Row: Velocity & AI Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading || !dashboardData ? (
          <>
            <WidgetSkeleton />
            <WidgetSkeleton />
          </>
        ) : (
          <>
            <DocumentVelocityWidget data={dashboardData.velocity} />
            <AIUtilizationWidget data={dashboardData.aiUtilization} />
          </>
        )}
      </div>

      {/* Second Row: Error Detection & Time Savings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading || !dashboardData ? (
          <>
            <WidgetSkeleton />
            <WidgetSkeleton />
          </>
        ) : (
          <>
            <ErrorDetectionWidget data={dashboardData.errorDetection} />
            <TimeSavingsWidget data={dashboardData.timeSavings} />
          </>
        )}
      </div>

      {/* Third Row: Template Usage & Quality Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading || !dashboardData ? (
          <>
            <WidgetSkeleton />
            <WidgetSkeleton />
          </>
        ) : (
          <>
            <TemplateUsageWidget data={dashboardData.templateUsage} />
            <QualityTrendsWidget data={dashboardData.qualityTrends} />
          </>
        )}
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-400">
        {dashboardData && (
          <>Ultima actualizare: {new Date(dashboardData.lastUpdated).toLocaleString('ro-RO')}</>
        )}
      </div>
    </div>
  );
}
