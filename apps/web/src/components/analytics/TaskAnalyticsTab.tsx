/**
 * Task Analytics Tab Content
 * Extracted from /analytics/tasks page for use in tabbed analytics view
 */

'use client';

import { useState, useMemo } from 'react';
import {
  BarChart2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Workflow,
  Users,
  DollarSign,
  Download,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { useTaskAnalyticsStore, type AnalyticsTab } from '@/stores/taskAnalyticsStore';
import {
  useTaskCompletionAnalytics,
  useOverdueAnalytics,
  useVelocityTrends,
  useTaskPatterns,
  useDelegationAnalytics,
  useROIDashboard,
  useCreateTemplateFromPattern,
  useDismissPattern,
} from '@/hooks/useTaskAnalytics';
import {
  CompletionTimeCharts,
  OverdueAnalysisPanel,
  VelocityTrendsChart,
  PatternDetectionPanel,
  DelegationAnalysisPanel,
  ROIDashboard,
} from '@/components/analytics';

// Tab configuration
const tabs: { id: AnalyticsTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'overview',
    label: 'Sumar',
    icon: <BarChart2 className="w-4 h-4" />,
    description: 'Rezumat al analizelor de sarcini',
  },
  {
    id: 'completion',
    label: 'Timp Finalizare',
    icon: <Clock className="w-4 h-4" />,
    description: 'Timp mediu de finalizare pe tip și utilizator',
  },
  {
    id: 'overdue',
    label: 'Întârzieri',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Sarcini întârziate și blocaje',
  },
  {
    id: 'velocity',
    label: 'Viteză',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Tendințe de productivitate în timp',
  },
  {
    id: 'patterns',
    label: 'Tipare',
    icon: <Workflow className="w-4 h-4" />,
    description: 'Tipare detectate de AI',
  },
  {
    id: 'delegation',
    label: 'Delegare',
    icon: <Users className="w-4 h-4" />,
    description: 'Analiză delegări și oportunități de instruire',
  },
  {
    id: 'roi',
    label: 'ROI',
    icon: <DollarSign className="w-4 h-4" />,
    description: 'Timp și costuri economisite prin automatizare',
  },
];

// Date range presets
const datePresets = [
  { value: 'last7', label: 'Ultimele 7 zile' },
  { value: 'last30', label: 'Ultimele 30 zile' },
  { value: 'lastQuarter', label: 'Ultimul trimestru' },
  { value: 'ytd', label: 'De la începutul anului' },
] as const;

// Loading skeleton
function WidgetSkeleton() {
  return (
    <div className="bg-linear-bg-secondary rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-linear-bg-hover rounded w-1/3 mb-4"></div>
      <div className="h-8 bg-linear-bg-hover rounded w-1/2 mb-6"></div>
      <div className="space-y-3">
        <div className="h-3 bg-linear-bg-hover rounded"></div>
        <div className="h-3 bg-linear-bg-hover rounded w-5/6"></div>
        <div className="h-3 bg-linear-bg-hover rounded w-4/6"></div>
      </div>
    </div>
  );
}

// Summary card component
function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendDirection,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'stable';
}) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-linear-success'
      : trendDirection === 'down'
        ? 'text-linear-error'
        : 'text-linear-text-tertiary';

  return (
    <div className="bg-linear-bg-secondary rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-linear-accent/10 rounded-lg">{icon}</div>
        {trend !== undefined && (
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendDirection === 'up' ? '+' : trendDirection === 'down' ? '' : ''}
            {trend.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-linear-text-primary">{value}</h3>
        <p className="text-sm text-linear-text-secondary mt-1">{title}</p>
        {subtitle && <p className="text-xs text-linear-text-tertiary mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// Overview tab content
function OverviewTab() {
  const { dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds } =
    useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data: completionData, loading: completionLoading } = useTaskCompletionAnalytics(filters);
  const { data: overdueData, loading: overdueLoading } = useOverdueAnalytics(filters);
  const { data: velocityData, loading: velocityLoading } = useVelocityTrends(filters);
  const { data: patternsData, loading: patternsLoading } = useTaskPatterns();
  const { data: delegationData, loading: delegationLoading } = useDelegationAnalytics(filters);
  const { data: roiData, loading: roiLoading } = useROIDashboard(filters);

  const isLoading =
    completionLoading ||
    overdueLoading ||
    velocityLoading ||
    patternsLoading ||
    delegationLoading ||
    roiLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <WidgetSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Timp mediu finalizare"
          value={`${completionData?.firmMetrics.avgCompletionTimeHours.toFixed(1) || 0}h`}
          subtitle="Pentru toate tipurile de sarcini"
          icon={<Clock className="w-5 h-5 text-linear-accent" />}
        />
        <SummaryCard
          title="Sarcini întârziate"
          value={overdueData?.totalOverdue || 0}
          subtitle={`${overdueData?.bottleneckPatterns.length || 0} blocaje detectate`}
          icon={<AlertTriangle className="w-5 h-5 text-linear-warning" />}
        />
        <SummaryCard
          title="Viteză curentă"
          value={velocityData?.firmVelocity.current.toFixed(1) || '0'}
          subtitle="Sarcini finalizate pe zi"
          icon={<TrendingUp className="w-5 h-5 text-linear-success" />}
          trend={velocityData?.firmVelocity.percentageChange}
          trendDirection={
            velocityData?.firmVelocity.trend === 'improving'
              ? 'up'
              : velocityData?.firmVelocity.trend === 'declining'
                ? 'down'
                : 'stable'
          }
        />
        <SummaryCard
          title="Tipare detectate"
          value={patternsData?.totalPatternsFound || 0}
          subtitle={`${patternsData?.highConfidenceCount || 0} cu încredere ridicată`}
          icon={<Workflow className="w-5 h-5 text-linear-accent" />}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard
          title="Rata succes delegări"
          value={`${((delegationData?.firmWideSuccessRate || 0) * 100).toFixed(0)}%`}
          subtitle="Media firmei"
          icon={<Users className="w-5 h-5 text-linear-accent" />}
        />
        <SummaryCard
          title="Oportunități instruire"
          value={delegationData?.trainingOpportunities.length || 0}
          subtitle="Utilizatori cu sugestii"
          icon={<Users className="w-5 h-5 text-linear-warning" />}
        />
        <SummaryCard
          title="Timp economisit"
          value={`${roiData?.currentPeriod?.totalTimeSavedHours?.toFixed(0) || 0}h`}
          subtitle="Perioada curentă"
          icon={<Clock className="w-5 h-5 text-linear-success" />}
        />
        <SummaryCard
          title="Valoare economisită"
          value={`${(roiData?.currentPeriod?.totalValueSaved || 0).toLocaleString()} RON`}
          subtitle={`${roiData?.projectedAnnualSavings?.toLocaleString() || 0} RON proiectat anual`}
          icon={<DollarSign className="w-5 h-5 text-linear-success" />}
        />
      </div>

      {/* Critical alerts */}
      {overdueData && overdueData.criticalTasks.length > 0 && (
        <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-linear-error mb-2">
            Sarcini critice întârziate ({overdueData.criticalTasks.length})
          </h3>
          <ul className="space-y-2">
            {overdueData.criticalTasks.slice(0, 5).map((task) => (
              <li key={task.taskId} className="flex items-center justify-between text-sm">
                <span className="text-linear-error">
                  {task.taskTitle} - {task.assigneeName}
                </span>
                <span className="text-linear-error font-medium">{task.daysOverdue} zile întârziere</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Tab content components that use the analytics hooks
function CompletionTab() {
  const { dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds } =
    useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data, loading } = useTaskCompletionAnalytics(filters);

  return <CompletionTimeCharts data={data} loading={loading} />;
}

function OverdueTab() {
  const { dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds } =
    useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data, loading } = useOverdueAnalytics(filters);

  return <OverdueAnalysisPanel data={data} loading={loading} />;
}

function VelocityTab() {
  const {
    dateRange,
    selectedTaskTypes,
    selectedUserIds,
    selectedCaseIds,
    velocityInterval,
    setVelocityInterval,
  } = useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data, loading } = useVelocityTrends(filters, velocityInterval);

  return (
    <VelocityTrendsChart
      data={data}
      loading={loading}
      interval={velocityInterval}
      onIntervalChange={setVelocityInterval}
    />
  );
}

function PatternsTab() {
  const { data, loading } = useTaskPatterns();
  const { createTemplate, loading: isCreatingTemplate } = useCreateTemplateFromPattern();
  const { dismissPattern } = useDismissPattern();

  const handleCreateTemplate = async (pattern: { id: string; suggestedTemplateName: string }) => {
    await createTemplate({
      patternId: pattern.id,
      templateName: pattern.suggestedTemplateName,
    });
  };

  const handleDismissPattern = async (patternId: string) => {
    await dismissPattern(patternId);
  };

  return (
    <PatternDetectionPanel
      data={data}
      loading={loading}
      onCreateTemplate={handleCreateTemplate}
      onDismissPattern={handleDismissPattern}
      isCreatingTemplate={isCreatingTemplate}
    />
  );
}

function DelegationTab() {
  const { dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds } =
    useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data, loading } = useDelegationAnalytics(filters);

  return <DelegationAnalysisPanel data={data} loading={loading} />;
}

function ROITab() {
  const { dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds } =
    useTaskAnalyticsStore();

  const filters = useMemo(
    () => ({
      dateRange,
      taskTypes: selectedTaskTypes.length > 0 ? selectedTaskTypes : undefined,
      userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
      caseIds: selectedCaseIds.length > 0 ? selectedCaseIds : undefined,
    }),
    [dateRange, selectedTaskTypes, selectedUserIds, selectedCaseIds]
  );

  const { data, loading } = useROIDashboard(filters);

  return <ROIDashboard data={data} loading={loading} />;
}

// Render content based on active tab
function TabContent({ tab }: { tab: AnalyticsTab }) {
  switch (tab) {
    case 'overview':
      return <OverviewTab />;
    case 'completion':
      return <CompletionTab />;
    case 'overdue':
      return <OverdueTab />;
    case 'velocity':
      return <VelocityTab />;
    case 'patterns':
      return <PatternsTab />;
    case 'delegation':
      return <DelegationTab />;
    case 'roi':
      return <ROITab />;
    default:
      return <OverviewTab />;
  }
}

/**
 * Task Analytics Tab Content
 */
export function TaskAnalyticsTab() {
  const { activeTab, setActiveTab, preset, setPreset, dateRange, isExporting, setIsExporting } =
    useTaskAnalyticsStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refetch queries would happen here via the hooks
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleExport = () => {
    setIsExporting(true);
    // Export logic would go here
    setTimeout(() => setIsExporting(false), 1000);
  };

  return (
    <div className="min-h-screen bg-linear-bg-primary">
      {/* Header */}
      <div className="bg-linear-bg-secondary shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-linear-text-primary">Analize Sarcini</h1>
              <p className="text-sm text-linear-text-secondary mt-1">
                Urmărește productivitatea, identifică tipare și optimizează fluxurile de lucru
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Date range selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-linear-text-tertiary" />
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as typeof preset)}
                  className="border border-linear-border-subtle rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-linear-accent focus:border-linear-accent bg-linear-bg-secondary"
                  aria-label="Selectează perioada"
                >
                  {datePresets.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center px-3 py-2 border border-linear-border-subtle rounded-md text-sm font-medium text-linear-text-secondary bg-linear-bg-secondary hover:bg-linear-bg-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50"
                aria-label="Reîmprospătează analizele"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Reîmprospătează
              </button>

              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center px-3 py-2 bg-linear-accent text-white rounded-md text-sm font-medium hover:bg-linear-accent-hover focus:outline-none focus:ring-2 focus:ring-linear-accent disabled:opacity-50"
                aria-label="Exportă analizele"
              >
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? 'Se exportă...' : 'Exportă'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="bg-linear-bg-secondary border-b border-linear-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex -mb-px overflow-x-auto" aria-label="Secțiuni analize">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-linear-accent text-linear-accent'
                      : 'border-transparent text-linear-text-tertiary hover:text-linear-text-secondary hover:border-linear-border-subtle'
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

      {/* Content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date range display */}
        <div className="mb-6 text-sm text-linear-text-secondary">
          Date afișate din{' '}
          <span className="font-medium">{dateRange.start.toLocaleDateString('ro-RO')}</span> până în{' '}
          <span className="font-medium">{dateRange.end.toLocaleDateString('ro-RO')}</span>
        </div>

        {/* Tab content */}
        <TabContent tab={activeTab} />
      </div>
    </div>
  );
}
