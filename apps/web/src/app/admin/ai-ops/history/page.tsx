/**
 * Batch Job History Page
 * OPS-245: Batch Job History Page
 *
 * Displays batch job execution history with filtering, pagination, and expandable error details.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { format, formatDistanceStrict } from 'date-fns';
import { ro } from 'date-fns/locale';
import clsx from 'clsx';
import {
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// GraphQL Query
// ============================================================================

const AI_BATCH_JOBS_QUERY = gql`
  query AIBatchJobs($feature: String, $status: AIBatchJobStatus, $limit: Int, $offset: Int) {
    aiBatchJobs(feature: $feature, status: $status, limit: $limit, offset: $offset) {
      id
      feature
      featureName
      status
      startedAt
      completedAt
      itemsProcessed
      itemsFailed
      totalTokens
      totalCostEur
      errorMessage
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

type JobStatus = 'running' | 'completed' | 'partial' | 'failed' | 'skipped';

interface AIBatchJobRun {
  id: string;
  feature: string;
  featureName: string;
  status: JobStatus;
  startedAt: string;
  completedAt: string | null;
  itemsProcessed: number;
  itemsFailed: number;
  totalTokens: number;
  totalCostEur: number;
  errorMessage: string | null;
}

// ============================================================================
// Feature Options for Filter
// ============================================================================

const FEATURE_OPTIONS = [
  { value: 'all', label: 'Toate procesoarele' },
  { value: 'search_index', label: 'Index Căutare' },
  { value: 'morning_briefings', label: 'Briefing-uri' },
  { value: 'case_health', label: 'Scor Sănătate' },
  { value: 'thread_summaries', label: 'Sumarizare Thread' },
  { value: 'case_context', label: 'Context Dosare' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Toate statusurile' },
  { value: 'completed', label: 'Finalizat' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Esuat' },
  { value: 'running', label: 'In curs' },
  { value: 'skipped', label: 'Sarit' },
];

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: JobStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    completed: {
      icon: Check,
      label: 'Finalizat',
      className: 'bg-green-100 text-green-800',
      iconClass: 'text-green-600',
    },
    partial: {
      icon: AlertTriangle,
      label: 'Partial',
      className: 'bg-yellow-100 text-yellow-800',
      iconClass: 'text-yellow-600',
    },
    failed: {
      icon: XCircle,
      label: 'Esuat',
      className: 'bg-red-100 text-red-800',
      iconClass: 'text-red-600',
    },
    running: {
      icon: Loader2,
      label: 'In curs',
      className: 'bg-blue-100 text-blue-800',
      iconClass: 'text-blue-600',
    },
    skipped: {
      icon: Clock,
      label: 'Sarit',
      className: 'bg-gray-100 text-gray-800',
      iconClass: 'text-gray-600',
    },
  };

  const { icon: Icon, label, className, iconClass } = config[status] || config.failed;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        className
      )}
    >
      <Icon className={clsx('w-3.5 h-3.5', iconClass, status === 'running' && 'animate-spin')} />
      {label}
    </span>
  );
}

// ============================================================================
// Job Row Component
// ============================================================================

interface JobRowProps {
  job: AIBatchJobRun;
}

function JobRow({ job }: JobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasError = job.errorMessage || job.itemsFailed > 0;

  // Calculate duration
  const duration = useMemo(() => {
    if (!job.startedAt) return '-';
    const start = new Date(job.startedAt);
    const end = job.completedAt ? new Date(job.completedAt) : new Date();
    return formatDistanceStrict(start, end, { locale: ro });
  }, [job.startedAt, job.completedAt]);

  // Format date/time
  const formattedDate = useMemo(() => {
    if (!job.startedAt) return '-';
    return format(new Date(job.startedAt), 'd MMM HH:mm', { locale: ro });
  }, [job.startedAt]);

  // Format cost
  const formattedCost = useMemo(() => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(job.totalCostEur);
  }, [job.totalCostEur]);

  // Format tokens
  const formattedTokens = useMemo(() => {
    return new Intl.NumberFormat('ro-RO').format(job.totalTokens);
  }, [job.totalTokens]);

  return (
    <>
      <tr
        className={clsx(
          'border-b border-gray-100 transition-colors',
          hasError ? 'cursor-pointer hover:bg-gray-50' : '',
          job.status === 'failed' && 'bg-red-50/50',
          job.status === 'partial' && 'bg-yellow-50/50'
        )}
        onClick={() => hasError && setExpanded(!expanded)}
      >
        {/* Expand indicator */}
        <td className="py-3 px-4 w-8">
          {hasError &&
            (expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ))}
        </td>

        {/* Feature name */}
        <td className="py-3 px-4 font-medium text-gray-900">{job.featureName}</td>

        {/* Start time */}
        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{formattedDate}</td>

        {/* Duration */}
        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{duration}</td>

        {/* Items processed */}
        <td className="py-3 px-4 text-gray-600 text-center">
          {job.itemsProcessed}
          {job.itemsFailed > 0 && <span className="text-red-600 ml-1">(-{job.itemsFailed})</span>}
        </td>

        {/* Tokens */}
        <td className="py-3 px-4 text-gray-600 text-right whitespace-nowrap">{formattedTokens}</td>

        {/* Cost */}
        <td className="py-3 px-4 text-gray-600 text-right whitespace-nowrap">{formattedCost}</td>

        {/* Status */}
        <td className="py-3 px-4">
          <StatusBadge status={job.status} />
        </td>
      </tr>

      {/* Expanded error details */}
      {expanded && hasError && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="py-4 px-8">
            <div className="text-sm">
              {job.itemsFailed > 0 && (
                <p className="text-yellow-700 mb-2">
                  {job.itemsFailed} elemente esuate din {job.itemsProcessed + job.itemsFailed}
                </p>
              )}
              {job.errorMessage && (
                <pre className="text-red-600 whitespace-pre-wrap font-mono text-xs bg-red-50 p-3 rounded-md border border-red-100 max-h-48 overflow-y-auto">
                  {job.errorMessage}
                </pre>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-12">
      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun job in istoric</h3>
      <p className="text-gray-500">Job-urile batch vor aparea aici dupa ce sunt executate.</p>
    </div>
  );
}

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

const PAGE_SIZE = 20;

export default function JobHistoryPage() {
  const [featureFilter, setFeatureFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  // Build query variables
  const variables = useMemo(
    () => ({
      feature: featureFilter === 'all' ? undefined : featureFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [featureFilter, statusFilter, page]
  );

  const { data, loading, error, refetch } = useQuery<{
    aiBatchJobs: AIBatchJobRun[];
  }>(AI_BATCH_JOBS_QUERY, {
    variables,
    fetchPolicy: 'cache-and-network',
  });

  const jobs = data?.aiBatchJobs ?? [];
  const hasMore = jobs.length === PAGE_SIZE;
  const hasPrevious = page > 0;

  // Reset to first page when filters change
  const handleFeatureChange = (value: string) => {
    setFeatureFilter(value);
    setPage(0);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(0);
  };

  // Export to CSV
  const handleExport = () => {
    if (!jobs.length) return;

    const headers = [
      'ID',
      'Procesor',
      'Status',
      'Start',
      'Sfarsit',
      'Elemente procesate',
      'Elemente esuate',
      'Tokeni',
      'Cost (EUR)',
      'Eroare',
    ];

    const rows = jobs.map((job: AIBatchJobRun) => [
      job.id,
      job.featureName,
      job.status,
      job.startedAt,
      job.completedAt || '',
      job.itemsProcessed,
      job.itemsFailed,
      job.totalTokens,
      job.totalCostEur,
      job.errorMessage || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: (string | number | null)[]) =>
        row.map((cell: string | number | null) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `istoric-joburi-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Istoric Joburi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vizualizare executari batch si diagnosticare erori
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={clsx('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Reimprospatare
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!jobs.length}>
            <Download className="w-4 h-4 mr-2" />
            Exporta CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Procesor:</span>
          <Select value={featureFilter} onValueChange={handleFeatureChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecteaza procesor" />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecteaza status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Eroare la incarcarea istoricului: {error.message}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading && !data ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8" />
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Procesor
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Start
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durata
                </th>
                <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Elemente
                </th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokeni
                </th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: AIBatchJobRun) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {jobs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Afiseaza {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + jobs.length} rezultate
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrevious}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Urmator
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
