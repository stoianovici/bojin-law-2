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
  const { status, assignedToMe, setStatus, setAssignedToMe, clearFilters } =
    useCaseFiltersStore();

  const handleStatusChange = (newStatus: string) => {
    const statusValue = newStatus === 'All' ? undefined : (newStatus as CaseStatus);
    setStatus(statusValue);
  };

  const handleAssignedToMeChange = (checked: boolean) => {
    setAssignedToMe(checked);
  };

  const hasActiveFilters = status !== undefined || assignedToMe;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* Status Filter */}
      <div className="flex-1 min-w-[200px]">
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

      {/* Assigned to Me Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="assigned-to-me"
          checked={assignedToMe}
          onChange={(e) => handleAssignedToMeChange(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="assigned-to-me" className="text-sm font-medium text-gray-700">
          Atribuite mie
        </label>
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
