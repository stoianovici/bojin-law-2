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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          onClick={fetchStatus}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Items Pending Review ({status.pendingReviewItems.length})
          </h2>
          <div className="space-y-3">
            {status.pendingReviewItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.discoveredTypeOriginal}</div>
                  <div className="text-sm text-gray-600">
                    {item.totalOccurrences} occurrences • {item.estimatedMonthlySavings}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Priority Score</div>
                    <div className="font-semibold text-gray-900">
                      {(item.priorityScore * 100).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {status.pendingReviewItems.length > 5 && (
            <button className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
              View all {status.pendingReviewItems.length} items →
            </button>
          )}
        </div>
      )}

      {/* Top Document Types */}
      {status.documentTypes && status.documentTypes.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Document Types by Priority
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occurrences
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Savings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {status.documentTypes.slice(0, 10).map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {type.discoveredTypeOriginal}
                      </div>
                      <div className="text-xs text-gray-500">{type.discoveredTypeEnglish}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {type.primaryLanguage.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {type.totalOccurrences}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={type.mappingStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-6 transition-all',
        highlight ? 'bg-yellow-50 border-yellow-300 shadow-md' : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-600 mb-2">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {percentage !== undefined && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    mapped: 'bg-green-100 text-green-800',
    pending_review: 'bg-yellow-100 text-yellow-800',
    auto_mapped: 'bg-blue-100 text-blue-800',
    unmapped: 'bg-gray-100 text-gray-800',
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
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', colorClasses[color])}>
      {percentage.toFixed(0)}
    </span>
  );
}
