/**
 * User Activity Table
 * OPS-247: Per-User AI Usage Dashboard
 *
 * Displays recent AI activity log entries for a user.
 * Shows timestamp, feature, tokens, cost, and entity info.
 */

'use client';

import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Clock, Zap, ExternalLink } from 'lucide-react';
import type { AIUsageLogEntry } from '@/hooks/useUserAIUsage';

// ============================================================================
// Types
// ============================================================================

interface UserActivityTableProps {
  data: AIUsageLogEntry[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function UserActivityTable({ data, loading, hasMore, onLoadMore }: UserActivityTableProps) {
  // Format values
  const formatCost = (value: number) => `€${value.toFixed(4)}`;
  const formatNumber = (value: number) => value.toLocaleString('ro-RO');
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading && data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Data', 'Funcționalitate', 'Tokeni', 'Cost', 'Durată'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Activitate Recentă</h3>
        </div>
        <div className="flex items-center justify-center h-48 text-gray-500">
          Nu există activitate înregistrată
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Activitate Recentă</h3>
        <p className="mt-1 text-sm text-gray-500">
          Ultimele apeluri AI pentru acest utilizator. Nu se înregistrează conținut, doar metrici.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Funcționalitate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tokeni
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durată
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Context
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((entry) => {
              const totalTokens = entry.inputTokens + entry.outputTokens;
              const createdAt = new Date(entry.createdAt);

              return (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span title={createdAt.toLocaleString('ro-RO')}>
                        {formatDistanceToNow(createdAt, {
                          addSuffix: true,
                          locale: ro,
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <Zap className="h-3 w-3" />
                      {entry.featureName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    <span
                      title={`${formatNumber(entry.inputTokens)} input + ${formatNumber(entry.outputTokens)} output`}
                    >
                      {formatNumber(totalTokens)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                    {formatCost(entry.costEur)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                    {formatDuration(entry.durationMs)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.entityType && entry.entityId ? (
                      <span className="flex items-center gap-1">
                        <span className="capitalize">{entry.entityType}</span>
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load more button */}
      {hasMore && onLoadMore && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-2 px-4 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Se încarcă...' : 'Încarcă mai multe'}
          </button>
        </div>
      )}
    </div>
  );
}
