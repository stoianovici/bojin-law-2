/**
 * Case Filters Component
 * Story 2.8: Case CRUD Operations UI - Task 4
 *
 * Filter controls for case list (status, client, assigned to me)
 */

'use client';

import type { CaseStatus } from '@legal-platform/types';
import { useCaseFiltersStore } from '../../stores/caseFiltersStore';

export function CaseFilters() {
  const { status, setStatus, clearFilters } = useCaseFiltersStore();

  const handleStatusChange = (newStatus: string) => {
    const statusValue = newStatus === 'All' ? undefined : (newStatus as CaseStatus);
    setStatus(statusValue);
  };

  const hasActiveFilters = status !== undefined;

  return (
    <div className="flex gap-4 items-end bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* Status Filter */}
      <div className="w-48">
        <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          id="status-filter"
          value={status || 'All'}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">Toate statusurile</option>
          <option value="Active">Activ</option>
          <option value="PendingApproval">În aprobare</option>
          <option value="OnHold">În așteptare</option>
          <option value="Closed">Închis</option>
          <option value="Archived">Arhivat</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Șterge filtrele
        </button>
      )}
    </div>
  );
}
