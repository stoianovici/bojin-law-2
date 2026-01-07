/**
 * Discovery Status Panel Component
 * Story 2.12.1 - Task 7: Admin Dashboard - Discovery status page
 *
 * Displays overview of document type discovery statistics and trends
 */

'use client';

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';

interface DiscoveryStatus {
  typesDiscovered: number;
  pendingReview: number;
  templatesCreated: number;
  estimatedROI: string;
  totalDocuments: number;
  mappedToSkills: number;
  averageConfidence: number;
  documentTypes?: DocumentType[];
  pendingReviewItems?: DocumentType[];
  trends?: TrendData[];
}

interface DocumentType {
  id: string;
  discoveredTypeOriginal: string;
  discoveredTypeNormalized: string;
  discoveredTypeEnglish: string | null;
  primaryLanguage: string;
  mappedSkillId: string | null;
  totalOccurrences: number;
  priorityScore: number;
  mappingStatus: string;
  confidence: number | null;
  lastDiscovered: Date;
  estimatedTimeSavings: number;
  estimatedMonthlySavings: string;
}

interface TrendData {
  date: string;
  typesDiscovered: number;
  documentsProcessed: number;
}

export function DiscoveryStatusPanel() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/discovery/status?detailed=true');
      if (!response.ok) {
        throw new Error('Failed to fetch discovery status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-linear-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-linear-error/10 border border-linear-error/30 rounded-lg p-4">
        <p className="text-linear-error">Error: {error}</p>
        <button
          onClick={fetchStatus}
          className="mt-2 text-sm text-linear-error hover:text-linear-error underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Types Discovered" value={status.typesDiscovered} icon="📚" color="blue" />
        <StatCard
          label="Pending Review"
          value={status.pendingReview}
          icon="⏳"
          color="yellow"
          highlight={status.pendingReview > 0}
        />
        <StatCard
          label="Templates Created"
          value={status.templatesCreated}
          icon="📝"
          color="green"
        />
        <StatCard label="Estimated ROI" value={status.estimatedROI} icon="💰" color="purple" />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Total Documents Processed"
          value={status.totalDocuments.toLocaleString()}
        />
        <MetricCard
          label="Types Mapped to Skills"
          value={`${status.mappedToSkills} / ${status.typesDiscovered}`}
          percentage={(status.mappedToSkills / status.typesDiscovered) * 100}
        />
        <MetricCard
          label="Average Confidence Score"
          value={`${(status.averageConfidence * 100).toFixed(1)}%`}
          percentage={status.averageConfidence * 100}
        />
      </div>

      {/* Pending Review Items */}
      {status.pendingReviewItems && status.pendingReviewItems.length > 0 && (
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
          <h2 className="text-lg font-semibold text-linear-text-primary mb-4">
            Items Pending Review ({status.pendingReviewItems.length})
          </h2>
          <div className="space-y-3">
            {status.pendingReviewItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-linear-bg-tertiary rounded-lg hover:bg-linear-bg-hover transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-linear-text-primary">
                    {item.discoveredTypeOriginal}
                  </div>
                  <div className="text-sm text-linear-text-secondary">
                    {item.totalOccurrences} occurrences • {item.estimatedMonthlySavings}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-linear-text-tertiary">Priority Score</div>
                    <div className="font-semibold text-linear-text-primary">
                      {(item.priorityScore * 100).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {status.pendingReviewItems.length > 5 && (
            <button className="mt-4 text-sm text-linear-accent hover:text-linear-accent-hover font-medium">
              View all {status.pendingReviewItems.length} items →
            </button>
          )}
        </div>
      )}

      {/* Top Document Types */}
      {status.documentTypes && status.documentTypes.length > 0 && (
        <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-6">
          <h2 className="text-lg font-semibold text-linear-text-primary mb-4">
            Top Document Types by Priority
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-linear-border-subtle">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Occurrences
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Monthly Savings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
                {status.documentTypes.slice(0, 10).map((type) => (
                  <tr key={type.id} className="hover:bg-linear-bg-hover">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-linear-text-primary">
                        {type.discoveredTypeOriginal}
                      </div>
                      <div className="text-xs text-linear-text-tertiary">
                        {type.discoveredTypeEnglish}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-secondary">
                      {type.primaryLanguage.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-primary">
                      {type.totalOccurrences}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={type.mappingStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-linear-text-primary">
                      {type.estimatedMonthlySavings}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityBadge score={type.priorityScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchStatus}
          className="px-4 py-2 bg-linear-accent text-white rounded-lg hover:bg-linear-accent-hover transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
}

// Helper Components

function StatCard({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'yellow' | 'green' | 'purple';
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-linear-accent/10 text-linear-accent border-linear-accent/30',
    yellow: 'bg-linear-warning/10 text-linear-warning border-linear-warning/30',
    green: 'bg-linear-success/10 text-linear-success border-linear-success/30',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-6 transition-all',
        highlight
          ? 'bg-linear-warning/10 border-linear-warning/30 shadow-md'
          : 'bg-linear-bg-secondary border-linear-border-subtle'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-linear-text-secondary">{label}</p>
          <p className="text-3xl font-bold text-linear-text-primary mt-2">{value}</p>
        </div>
        <div className={clsx('text-4xl p-3 rounded-lg', colorClasses[color])}>{icon}</div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  percentage,
}: {
  label: string;
  value: string;
  percentage?: number;
}) {
  return (
    <div className="bg-linear-bg-secondary rounded-lg border border-linear-border-subtle p-4">
      <div className="text-sm font-medium text-linear-text-secondary mb-2">{label}</div>
      <div className="text-2xl font-bold text-linear-text-primary">{value}</div>
      {percentage !== undefined && (
        <div className="mt-2 w-full bg-linear-bg-hover rounded-full h-2">
          <div
            className="bg-linear-accent h-2 rounded-full transition-all"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    mapped: 'bg-linear-success/15 text-linear-success',
    pending_review: 'bg-linear-warning/15 text-linear-warning',
    auto_mapped: 'bg-linear-accent/15 text-linear-accent',
    unmapped: 'bg-linear-bg-tertiary text-linear-text-secondary',
  };

  const labels: Record<string, string> = {
    mapped: 'Mapped',
    pending_review: 'Pending Review',
    auto_mapped: 'Auto-Mapped',
    unmapped: 'Unmapped',
  };

  return (
    <span
      className={clsx(
        'px-2 py-1 text-xs font-medium rounded-full',
        styles[status] || styles.unmapped
      )}
    >
      {labels[status] || status}
    </span>
  );
}

function PriorityBadge({ score }: { score: number }) {
  const percentage = score * 100;
  let color = 'gray';

  if (percentage >= 80) color = 'red';
  else if (percentage >= 60) color = 'orange';
  else if (percentage >= 40) color = 'yellow';

  const colorClasses: Record<string, string> = {
    red: 'bg-linear-error/15 text-linear-error',
    orange: 'bg-linear-warning/15 text-linear-warning',
    yellow: 'bg-linear-warning/10 text-linear-warning',
    gray: 'bg-linear-bg-tertiary text-linear-text-secondary',
  };

  return (
    <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', colorClasses[color])}>
      {percentage.toFixed(0)}
    </span>
  );
}
