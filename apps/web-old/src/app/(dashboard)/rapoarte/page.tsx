/**
 * Reports Page (Rapoarte)
 * OPS-366: Reports page with multiple report types, date range filtering, and export
 *
 * Features:
 * - Tab-based report type selector (Cazuri, Timp, Facturare, Utilizare AI)
 * - Date range picker with presets
 * - Export buttons (CSV, PDF)
 * - Charts and tables per report type
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  DollarSign,
  Sparkles,
  Download,
  FileText,
  Calendar,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { PageLayout, PageHeader, PageContent } from '@/components/linear/PageLayout';
import { TabBar } from '@/components/linear/TabBar';
import { MinimalTable, type ColumnDef, NumericCell } from '@/components/linear/MinimalTable';
import { StatusDot } from '@/components/linear/StatusDot';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ReportType = 'cases' | 'time' | 'billing' | 'ai';
type DatePreset = 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'custom';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

interface ReportSummary {
  totalValue: number;
  averageValue: number;
  changeFromPrevious?: number;
  trendDirection?: 'up' | 'down' | 'stable';
}

interface ReportData {
  reportId: string;
  data: ChartDataPoint[];
  summary?: ReportSummary;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface RevenueByBillingType {
  hourly: number;
  fixed: number;
  retainer: number;
}

interface UtilizationByRole {
  role: string;
  billableHours: number;
  totalHours: number;
  utilizationRate: number;
}

interface CaseProfitability {
  caseId: string;
  caseName: string;
  billingType: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

interface FinancialKPIs {
  totalRevenue: number;
  revenueByBillingType: RevenueByBillingType;
  totalBillableHours: number;
  totalNonBillableHours: number;
  utilizationRate: number;
  utilizationByRole: UtilizationByRole[];
  realizationRate: number;
  effectiveHourlyRate: number;
  profitabilityByCase: CaseProfitability[];
  dataScope: string;
  calculatedAt: string;
  caseCount: number;
}

interface ModelUsage {
  model: string;
  tokens: number;
  costCents: number;
  requestCount: number;
}

interface OperationUsage {
  operation: string;
  tokens: number;
  costCents: number;
  requestCount: number;
}

interface AIUsageStats {
  totalTokens: number;
  totalCostCents: number;
  requestCount: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  byModel: ModelUsage[];
  byOperation: OperationUsage[];
}

interface ReportDataQueryResult {
  reportData: ReportData | null;
}

interface FinancialKPIsQueryResult {
  financialKPIs: FinancialKPIs | null;
}

interface AIUsageStatsQueryResult {
  aiUsageStats: AIUsageStats | null;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const GET_REPORT_DATA = gql`
  query GetReportData($reportId: ID!, $dateRange: DateRangeInput) {
    reportData(reportId: $reportId, dateRange: $dateRange) {
      reportId
      data {
        label
        value
        color
        metadata
      }
      summary {
        totalValue
        averageValue
        changeFromPrevious
        trendDirection
      }
    }
  }
`;

const GET_FINANCIAL_KPIS = gql`
  query GetFinancialKPIs($dateRange: DateRangeInput) {
    financialKPIs(dateRange: $dateRange) {
      totalRevenue
      revenueByBillingType {
        hourly
        fixed
        retainer
      }
      totalBillableHours
      totalNonBillableHours
      utilizationRate
      utilizationByRole {
        role
        billableHours
        totalHours
        utilizationRate
      }
      realizationRate
      effectiveHourlyRate
      profitabilityByCase {
        caseId
        caseName
        billingType
        revenue
        cost
        margin
        marginPercent
      }
      dataScope
      calculatedAt
      caseCount
    }
  }
`;

const GET_AI_USAGE_STATS = gql`
  query GetAIUsageStats($dateRange: DateRangeInput!, $firmId: ID!) {
    aiUsageStats(dateRange: $dateRange, firmId: $firmId) {
      totalTokens
      totalCostCents
      requestCount
      avgLatencyMs
      cacheHitRate
      byModel {
        model
        tokens
        costCents
        requestCount
      }
      byOperation {
        operation
        tokens
        costCents
        requestCount
      }
    }
  }
`;

// ============================================================================
// Date Range Helpers
// ============================================================================

function getDateRangeForPreset(preset: DatePreset): DateRange {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'thisWeek': {
      const start = new Date(end);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case 'thisQuarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterStart, 1);
      return { start, end };
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end };
    }
    default:
      // Default to last 30 days
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end };
  }
}

function formatDateRange(range: DateRange): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${range.start.toLocaleDateString('ro-RO', options)} - ${range.end.toLocaleDateString('ro-RO', options)}`;
}

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  thisWeek: 'Săptămâna aceasta',
  thisMonth: 'Luna aceasta',
  thisQuarter: 'Trimestrul acesta',
  thisYear: 'Anul acesta',
  custom: 'Personalizat',
};

// ============================================================================
// DateRangePicker Component
// ============================================================================

interface DateRangePickerProps {
  preset: DatePreset;
  onChange: (preset: DatePreset) => void;
  dateRange: DateRange;
}

function DateRangePicker({ preset, onChange, dateRange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary px-3 py-2',
          'text-sm text-linear-text-primary transition-colors hover:border-linear-border-default'
        )}
      >
        <Calendar className="h-4 w-4 text-linear-text-tertiary" />
        <span className="font-medium">{DATE_PRESET_LABELS[preset]}</span>
        <span className="text-linear-text-tertiary">·</span>
        <span className="text-linear-text-secondary">{formatDateRange(dateRange)}</span>
        <ChevronDown className="h-4 w-4 text-linear-text-tertiary" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-linear-border-subtle bg-linear-bg-secondary py-1 shadow-lg">
            {(Object.keys(DATE_PRESET_LABELS) as DatePreset[])
              .filter((p) => p !== 'custom')
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
                    preset === p
                      ? 'bg-linear-accent-muted text-linear-accent'
                      : 'text-linear-text-primary hover:bg-linear-bg-hover'
                  )}
                >
                  {DATE_PRESET_LABELS[p]}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ExportButtons Component
// ============================================================================

interface ExportButtonsProps {
  onExportCSV: () => void;
  onExportPDF: () => void;
  loading?: boolean;
}

function ExportButtons({ onExportCSV, onExportPDF, loading }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onExportCSV} disabled={loading} className="gap-2">
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button variant="ghost" size="sm" onClick={onExportPDF} disabled={loading} className="gap-2">
        <FileText className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}

// ============================================================================
// TrendIndicator Component
// ============================================================================

interface TrendIndicatorProps {
  direction?: 'up' | 'down' | 'stable';
  change?: number;
}

function TrendIndicator({ direction, change }: TrendIndicatorProps) {
  if (!direction) return null;

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const colorClass =
    direction === 'up'
      ? 'text-linear-success'
      : direction === 'down'
        ? 'text-linear-error'
        : 'text-linear-text-tertiary';

  return (
    <div className={cn('flex items-center gap-1', colorClass)}>
      <Icon className="h-4 w-4" />
      {change !== undefined && (
        <span className="text-sm font-medium">
          {change > 0 ? '+' : ''}
          {change.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ============================================================================
// SimpleBarChart Component
// ============================================================================

interface SimpleBarChartProps {
  data: ChartDataPoint[];
  height?: number;
  showLabels?: boolean;
}

function SimpleBarChart({ data, height = 200, showLabels = true }: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((point, index) => {
          const barHeight = (point.value / maxValue) * 100;
          return (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${barHeight}%`,
                  backgroundColor: point.color || '#5E6AD2',
                  minHeight: point.value > 0 ? 4 : 0,
                }}
              />
              {showLabels && (
                <span className="text-[10px] text-linear-text-tertiary truncate max-w-full text-center">
                  {point.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MetricCard Component
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: TrendIndicatorProps;
  icon?: React.ReactNode;
}

function MetricCard({ title, value, subtitle, trend, icon }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-linear-text-tertiary">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
        </div>
        {trend && <TrendIndicator {...trend} />}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-linear-text-primary">{value}</div>
      {subtitle && <div className="mt-1 text-sm text-linear-text-tertiary">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// CasesReport Component
// ============================================================================

function CasesReport({ dateRange }: { dateRange: DateRange }) {
  const { data: statusData, loading: statusLoading } = useQuery<ReportDataQueryResult>(
    GET_REPORT_DATA,
    {
      variables: {
        reportId: 'cases-status-overview',
        dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
      },
    }
  );

  const { data: typeData, loading: typeLoading } = useQuery<ReportDataQueryResult>(
    GET_REPORT_DATA,
    {
      variables: {
        reportId: 'cases-by-type',
        dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
      },
    }
  );

  const loading = statusLoading || typeLoading;
  const statusReport = statusData?.reportData;
  const typeReport = typeData?.reportData;

  if (loading) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total cazuri"
          value={statusReport?.summary?.totalValue ?? 0}
          icon={<BarChart3 className="h-4 w-4" />}
          trend={
            statusReport?.summary?.trendDirection
              ? { direction: statusReport.summary.trendDirection }
              : undefined
          }
        />
        <MetricCard
          title="Active"
          value={statusReport?.data?.find((d) => d.label === 'Activ')?.value ?? 0}
          icon={<StatusDot status="active" size="sm" />}
        />
        <MetricCard
          title="În așteptare"
          value={statusReport?.data?.find((d) => d.label === 'În așteptare')?.value ?? 0}
          icon={<StatusDot status="pending" size="sm" />}
        />
        <MetricCard
          title="Închise"
          value={statusReport?.data?.find((d) => d.label === 'Închis')?.value ?? 0}
          icon={<StatusDot status="neutral" size="sm" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-6">
        {/* Cases by Status */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-medium text-linear-text-primary">Cazuri după status</h3>
          {statusReport?.data && statusReport.data.length > 0 ? (
            <SimpleBarChart data={statusReport.data} height={180} />
          ) : (
            <EmptyChartState message="Nu există date pentru perioada selectată" />
          )}
        </div>

        {/* Cases by Type */}
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-medium text-linear-text-primary">Cazuri după tip</h3>
          {typeReport?.data && typeReport.data.length > 0 ? (
            <SimpleBarChart data={typeReport.data} height={180} />
          ) : (
            <EmptyChartState message="Nu există date pentru perioada selectată" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TimeReport Component
// ============================================================================

function TimeReport({ dateRange }: { dateRange: DateRange }) {
  const { data, loading } = useQuery<ReportDataQueryResult>(GET_REPORT_DATA, {
    variables: {
      reportId: 'time-by-team-member',
      dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    },
  });

  const { data: utilizationData, loading: utilizationLoading } = useQuery<ReportDataQueryResult>(
    GET_REPORT_DATA,
    {
      variables: {
        reportId: 'team-utilization',
        dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
      },
    }
  );

  const report = data?.reportData;
  const utilization = utilizationData?.reportData;

  if (loading || utilizationLoading) {
    return <ReportSkeleton />;
  }

  const columns: ColumnDef<ChartDataPoint>[] = [
    {
      id: 'name',
      header: 'Utilizator',
      accessor: (row) => <span className="font-medium text-linear-text-primary">{row.label}</span>,
    },
    {
      id: 'hours',
      header: 'Ore',
      align: 'right',
      accessor: (row) => <NumericCell value={row.value.toFixed(1)} unit="h" />,
    },
    {
      id: 'revenue',
      header: 'Venit estimat',
      align: 'right',
      accessor: (row) => {
        const revenue = (row.metadata?.revenue as number) || 0;
        return <NumericCell value={`€${revenue.toFixed(0)}`} positive={revenue > 0} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total ore"
          value={`${(report?.summary?.totalValue ?? 0).toFixed(1)}h`}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          title="Media per persoană"
          value={`${(report?.summary?.averageValue ?? 0).toFixed(1)}h`}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          title="Rata utilizare"
          value={`${(utilization?.summary?.averageValue ?? 0).toFixed(0)}%`}
          subtitle="Ore facturabile / total"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Membrii echipei"
          value={report?.data?.length ?? 0}
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      {/* Chart and Table */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-medium text-linear-text-primary">Ore pe membru</h3>
          {report?.data && report.data.length > 0 ? (
            <SimpleBarChart data={report.data} height={200} />
          ) : (
            <EmptyChartState message="Nu există înregistrări de timp" />
          )}
        </div>

        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <div className="border-b border-linear-border-subtle px-5 py-3">
            <h3 className="text-sm font-medium text-linear-text-primary">Detalii echipă</h3>
          </div>
          <div className="p-4">
            {report?.data && report.data.length > 0 ? (
              <MinimalTable
                columns={columns}
                data={report.data}
                getRowKey={(row, idx) => `${row.label}-${idx}`}
              />
            ) : (
              <EmptyChartState message="Nu există date" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BillingReport Component
// ============================================================================

function BillingReport({ dateRange }: { dateRange: DateRange }) {
  const { data, loading, error } = useQuery<FinancialKPIsQueryResult>(GET_FINANCIAL_KPIS, {
    variables: {
      dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
    },
    errorPolicy: 'all',
  });

  if (loading) {
    return <ReportSkeleton />;
  }

  // Handle access denied or no data
  const kpis = data?.financialKPIs;
  if (error || !kpis) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <DollarSign className="h-12 w-12 text-linear-text-muted" />
        <h3 className="mt-4 text-base font-medium text-linear-text-primary">Acces restricționat</h3>
        <p className="mt-1 text-sm text-linear-text-tertiary">
          Rapoartele financiare sunt disponibile doar pentru Parteneri și Business Owner.
        </p>
      </div>
    );
  }

  const revenueByType = [
    { label: 'Orar', value: kpis.revenueByBillingType.hourly, color: '#3b82f6' },
    { label: 'Sumă fixă', value: kpis.revenueByBillingType.fixed, color: '#10b981' },
    { label: 'Abonament', value: kpis.revenueByBillingType.retainer, color: '#f59e0b' },
  ];

  const columns: ColumnDef<{
    caseId: string;
    caseName: string;
    revenue: number;
    margin: number;
    marginPercent: number;
  }>[] = [
    {
      id: 'case',
      header: 'Dosar',
      accessor: (row) => (
        <span className="font-medium text-linear-text-primary">{row.caseName}</span>
      ),
    },
    {
      id: 'revenue',
      header: 'Venit',
      align: 'right',
      accessor: (row) => <NumericCell value={`€${row.revenue.toFixed(0)}`} />,
    },
    {
      id: 'margin',
      header: 'Marjă',
      align: 'right',
      accessor: (row) => (
        <span
          className={cn(
            'font-mono',
            row.marginPercent >= 0 ? 'text-linear-success' : 'text-linear-error'
          )}
        >
          {row.marginPercent.toFixed(0)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Venit total"
          value={`€${kpis.totalRevenue.toFixed(0)}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Ore facturabile"
          value={`${kpis.totalBillableHours.toFixed(1)}h`}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          title="Rata realizare"
          value={`${kpis.realizationRate.toFixed(0)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Tarif efectiv"
          value={`€${kpis.effectiveHourlyRate.toFixed(0)}/h`}
          subtitle={`${kpis.caseCount} cazuri`}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-medium text-linear-text-primary">
            Venit după tip facturare
          </h3>
          <SimpleBarChart data={revenueByType} height={180} />
        </div>

        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <div className="border-b border-linear-border-subtle px-5 py-3">
            <h3 className="text-sm font-medium text-linear-text-primary">
              Top cazuri profitabilitate
            </h3>
          </div>
          <div className="p-4">
            {kpis.profitabilityByCase.length > 0 ? (
              <MinimalTable
                columns={columns}
                data={kpis.profitabilityByCase.slice(0, 5)}
                getRowKey={(row) => row.caseId}
              />
            ) : (
              <EmptyChartState message="Nu există date" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AIUsageReport Component
// ============================================================================

function AIUsageReport({ dateRange, firmId }: { dateRange: DateRange; firmId: string }) {
  const { data, loading, error } = useQuery<AIUsageStatsQueryResult>(GET_AI_USAGE_STATS, {
    variables: {
      dateRange: { start: dateRange.start.toISOString(), end: dateRange.end.toISOString() },
      firmId,
    },
    errorPolicy: 'all',
    skip: !firmId,
  });

  if (loading) {
    return <ReportSkeleton />;
  }

  const stats = data?.aiUsageStats;
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Sparkles className="h-12 w-12 text-linear-text-muted" />
        <h3 className="mt-4 text-base font-medium text-linear-text-primary">Acces restricționat</h3>
        <p className="mt-1 text-sm text-linear-text-tertiary">
          Rapoartele AI sunt disponibile doar pentru Parteneri și Business Owner.
        </p>
      </div>
    );
  }

  const modelData: ChartDataPoint[] = stats.byModel.map((m, idx) => ({
    label: m.model,
    value: m.tokens,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 4],
  }));

  const columns: ColumnDef<{
    operation: string;
    tokens: number;
    costCents: number;
    requestCount: number;
  }>[] = [
    {
      id: 'operation',
      header: 'Operație',
      accessor: (row) => (
        <span className="font-medium text-linear-text-primary">{row.operation}</span>
      ),
    },
    {
      id: 'tokens',
      header: 'Token-uri',
      align: 'right',
      accessor: (row) => <NumericCell value={row.tokens.toLocaleString('ro-RO')} />,
    },
    {
      id: 'cost',
      header: 'Cost',
      align: 'right',
      accessor: (row) => <NumericCell value={`€${(row.costCents / 100).toFixed(2)}`} />,
    },
    {
      id: 'requests',
      header: 'Cereri',
      align: 'right',
      accessor: (row) => <NumericCell value={row.requestCount} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total token-uri"
          value={stats.totalTokens.toLocaleString('ro-RO')}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <MetricCard
          title="Cost total"
          value={`€${(stats.totalCostCents / 100).toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Cereri"
          value={stats.requestCount.toLocaleString('ro-RO')}
          subtitle={`${stats.avgLatencyMs.toFixed(0)}ms latență medie`}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <MetricCard
          title="Cache hit rate"
          value={`${(stats.cacheHitRate * 100).toFixed(0)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
          <h3 className="mb-4 text-sm font-medium text-linear-text-primary">
            Utilizare după model
          </h3>
          {modelData.length > 0 ? (
            <SimpleBarChart data={modelData} height={180} />
          ) : (
            <EmptyChartState message="Nu există date AI" />
          )}
        </div>

        <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary">
          <div className="border-b border-linear-border-subtle px-5 py-3">
            <h3 className="text-sm font-medium text-linear-text-primary">
              Utilizare după operație
            </h3>
          </div>
          <div className="p-4">
            {stats.byOperation.length > 0 ? (
              <MinimalTable
                columns={columns}
                data={stats.byOperation}
                getRowKey={(row) => row.operation}
              />
            ) : (
              <EmptyChartState message="Nu există date" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-4"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-linear-bg-tertiary" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-linear-bg-tertiary" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5"
          >
            <div className="h-4 w-32 animate-pulse rounded bg-linear-bg-tertiary" />
            <div className="mt-4 h-[180px] animate-pulse rounded bg-linear-bg-tertiary" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center">
      <p className="text-sm text-linear-text-tertiary">{message}</p>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function RapoartePage() {
  const [activeTab, setActiveTab] = useState<ReportType>('cases');
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const dateRange = useMemo(() => getDateRangeForPreset(datePreset), [datePreset]);

  // For AI usage, we need firmId - this should come from user context
  // For now, we'll use a placeholder that will be populated from the user's firm
  const firmId = ''; // TODO: Get from user context when available

  const tabs = [
    { value: 'cases' as const, label: 'Cazuri', icon: BarChart3 },
    { value: 'time' as const, label: 'Timp', icon: Clock },
    { value: 'billing' as const, label: 'Facturare', icon: DollarSign },
    { value: 'ai' as const, label: 'Utilizare AI', icon: Sparkles },
  ];

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log('Export CSV for', activeTab, dateRange);
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF for', activeTab, dateRange);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Rapoarte"
        actions={<ExportButtons onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />}
      />

      <PageContent>
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-linear-border-subtle pb-4">
          <TabBar
            tabs={tabs.map((t) => ({ value: t.value, label: t.label }))}
            value={activeTab}
            onChange={setActiveTab}
            className="border-b-0 px-0"
          />
          <DateRangePicker preset={datePreset} onChange={setDatePreset} dateRange={dateRange} />
        </div>

        {/* Report Content */}
        <div className="mt-6">
          {activeTab === 'cases' && <CasesReport dateRange={dateRange} />}
          {activeTab === 'time' && <TimeReport dateRange={dateRange} />}
          {activeTab === 'billing' && <BillingReport dateRange={dateRange} />}
          {activeTab === 'ai' && <AIUsageReport dateRange={dateRange} firmId={firmId} />}
        </div>
      </PageContent>
    </PageLayout>
  );
}
