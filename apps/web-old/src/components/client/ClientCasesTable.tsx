'use client';

/**
 * ClientCasesTable Component
 * OPS-227: Client Profile Page + Case Links
 *
 * Displays all cases for a client with status badges and navigation
 */

import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Filter } from 'lucide-react';
import type { CaseSummaryForClient } from '../../hooks/useClient';

// ============================================================================
// Types
// ============================================================================

export interface ClientCasesTableProps {
  cases: CaseSummaryForClient[];
  className?: string;
}

type CaseStatus = 'Pending' | 'Active' | 'OnHold' | 'Closed' | 'Archived';
type SortField = 'caseNumber' | 'title' | 'status' | 'type' | 'openedDate';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// Sort Header Button
// ============================================================================

interface SortHeaderProps {
  field: SortField;
  children: React.ReactNode;
  sortField: SortField;
  onSort: (field: SortField) => void;
}

function SortHeader({ field, children, sortField, onSort }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={clsx(
        'flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900',
        sortField === field && 'text-blue-600'
      )}
    >
      {children}
      <ArrowUpDown
        className={clsx('w-3.5 h-3.5', sortField === field ? 'text-blue-600' : 'text-gray-400')}
      />
    </button>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: CaseStatus }) {
  const statusConfig: Record<CaseStatus, { label: string; className: string }> = {
    Pending: {
      label: 'În așteptare',
      className: 'bg-orange-100 text-orange-800',
    },
    Active: {
      label: 'Activ',
      className: 'bg-green-100 text-green-800',
    },
    OnHold: {
      label: 'Suspendat',
      className: 'bg-yellow-100 text-yellow-800',
    },
    Closed: {
      label: 'Închis',
      className: 'bg-gray-100 text-gray-800',
    },
    Archived: {
      label: 'Arhivat',
      className: 'bg-slate-100 text-slate-800',
    },
  };

  const config = statusConfig[status] || statusConfig.Active;

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ClientCasesTable({ cases, className }: ClientCasesTableProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('openedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort cases
  const sortedCases = useMemo(() => {
    let filtered = [...cases];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Apply sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'caseNumber':
          comparison = a.caseNumber.localeCompare(b.caseNumber);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'openedDate':
          comparison = new Date(a.openedDate).getTime() - new Date(b.openedDate).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [cases, sortField, sortDirection, statusFilter]);

  // Navigate to case
  const handleRowClick = (caseId: string) => {
    router.push(`/cases/${caseId}`);
  };

  // Get unique statuses for filter
  const availableStatuses = useMemo(() => {
    const statuses = new Set(cases.map((c) => c.status));
    return Array.from(statuses) as CaseStatus[];
  }, [cases]);

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: ro });
    } catch {
      return '-';
    }
  };

  if (cases.length === 0) {
    return (
      <div className={clsx('bg-white rounded-lg border border-gray-200 p-8', className)}>
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Niciun dosar</p>
          <p className="mt-1 text-sm">Acest client nu are dosare înregistrate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg border border-gray-200', className)}>
      {/* Header with filter */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Dosare</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Toate ({cases.length})</option>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status === 'Active' ? 'Active' : status === 'Closed' ? 'Închise' : status} (
                {cases.filter((c) => c.status === status).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <SortHeader field="caseNumber" sortField={sortField} onSort={handleSort}>
                  Nr. Intern
                </SortHeader>
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <SortHeader field="title" sortField={sortField} onSort={handleSort}>
                  Titlu
                </SortHeader>
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <SortHeader field="status" sortField={sortField} onSort={handleSort}>
                  Status
                </SortHeader>
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <SortHeader field="type" sortField={sortField} onSort={handleSort}>
                  Tip
                </SortHeader>
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <SortHeader field="openedDate" sortField={sortField} onSort={handleSort}>
                  Data deschidere
                </SortHeader>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCases.map((caseItem) => (
              <tr
                key={caseItem.id}
                onClick={() => handleRowClick(caseItem.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    {caseItem.caseNumber || '-'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-gray-900 line-clamp-1">{caseItem.title}</span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <StatusBadge status={caseItem.status} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{caseItem.type}</span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">{formatDate(caseItem.openedDate)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-500">
          {sortedCases.length} {sortedCases.length === 1 ? 'dosar' : 'dosare'}
          {statusFilter !== 'all' && ` (filtrate din ${cases.length} total)`}
        </p>
      </div>
    </div>
  );
}

ClientCasesTable.displayName = 'ClientCasesTable';
