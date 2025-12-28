/**
 * User Usage Table
 * OPS-244: Cost Breakdown & Charts Page
 * OPS-247: Per-User AI Usage Dashboard - Added row click navigation
 *
 * Sortable table showing AI usage per user.
 * Clicking a row navigates to the user's detail page.
 */

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import type { AIUserCost } from '@/hooks/useAICosts';

// ============================================================================
// Types
// ============================================================================

interface UserUsageTableProps {
  data: AIUserCost[];
  loading?: boolean;
}

type SortField = 'userName' | 'cost' | 'tokens' | 'calls';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Component
// ============================================================================

export function UserUsageTable({ data, loading }: UserUsageTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Navigate to user detail page
  const handleRowClick = (userId: string) => {
    // Don't navigate for batch user
    if (userId === 'batch') return;
    router.push(`/admin/ai-ops/users/${userId}`);
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [data, sortField, sortDirection]);

  // Handle column header click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-linear-text-muted" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-linear-accent" />
    ) : (
      <ArrowDown className="h-4 w-4 text-linear-accent" />
    );
  };

  // Format values
  const formatCost = (value: number) => `€${value.toFixed(2)}`;
  const formatNumber = (value: number) => value.toLocaleString('ro-RO');

  if (loading) {
    return (
      <div className="bg-linear-bg-secondary rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-linear-border-subtle">
          <div className="h-6 w-48 bg-linear-bg-hover rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-linear-border-subtle">
            <thead className="bg-linear-bg-tertiary">
              <tr>
                {['Utilizator', 'Cost', 'Tokeni', 'Apeluri'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="h-4 w-32 bg-linear-bg-hover rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-16 bg-linear-bg-hover rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-20 bg-linear-bg-hover rounded animate-pulse" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-12 bg-linear-bg-hover rounded animate-pulse" />
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
      <div className="bg-linear-bg-secondary rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-linear-border-subtle">
          <h3 className="text-lg font-semibold text-linear-text-primary">Cost pe Utilizator</h3>
        </div>
        <div className="flex items-center justify-center h-48 text-linear-text-tertiary">
          Nu există date pentru perioada selectată
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalCost = data.reduce((sum, u) => sum + u.cost, 0);
  const totalTokens = data.reduce((sum, u) => sum + u.tokens, 0);
  const totalCalls = data.reduce((sum, u) => sum + u.calls, 0);

  return (
    <div className="bg-linear-bg-secondary rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-linear-border-subtle">
        <h3 className="text-lg font-semibold text-linear-text-primary">Cost pe Utilizator</h3>
        <p className="mt-1 text-sm text-linear-text-tertiary">
          Nu se înregistrează conținutul conversațiilor, doar metrici agregate.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-linear-border-subtle">
          <thead className="bg-linear-bg-tertiary">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-linear-text-tertiary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover"
                onClick={() => handleSort('userName')}
              >
                <div className="flex items-center gap-1">
                  Utilizator
                  {getSortIcon('userName')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover"
                onClick={() => handleSort('cost')}
              >
                <div className="flex items-center justify-end gap-1">
                  Cost
                  {getSortIcon('cost')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover"
                onClick={() => handleSort('tokens')}
              >
                <div className="flex items-center justify-end gap-1">
                  Tokeni
                  {getSortIcon('tokens')}
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-medium text-linear-text-tertiary uppercase tracking-wider cursor-pointer hover:bg-linear-bg-hover"
                onClick={() => handleSort('calls')}
              >
                <div className="flex items-center justify-end gap-1">
                  Apeluri
                  {getSortIcon('calls')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-linear-bg-secondary divide-y divide-linear-border-subtle">
            {sortedData.map((user) => {
              const isClickable = user.userId !== 'batch';
              return (
                <tr
                  key={user.userId}
                  className={`hover:bg-linear-bg-hover ${isClickable ? 'cursor-pointer' : ''}`}
                  onClick={isClickable ? () => handleRowClick(user.userId) : undefined}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-linear-text-primary">
                    <div className="flex items-center gap-2">
                      {user.userName}
                      {isClickable && <ChevronRight className="h-4 w-4 text-linear-text-muted" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-primary text-right">
                    {formatCost(user.cost)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-secondary text-right">
                    {formatNumber(user.tokens)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-secondary text-right">
                    {formatNumber(user.calls)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-linear-bg-tertiary">
            <tr className="font-medium">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-primary">
                Total ({data.length} utilizatori)
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-primary text-right">
                {formatCost(totalCost)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-secondary text-right">
                {formatNumber(totalTokens)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-linear-text-secondary text-right">
                {formatNumber(totalCalls)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
