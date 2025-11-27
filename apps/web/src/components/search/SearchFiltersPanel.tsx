/**
 * Search Filters Panel Component
 * Story 2.10: Basic AI Search Implementation - Task 20
 *
 * Filter panel for refining search results by date, type, status, etc.
 */

'use client';

import { useState } from 'react';
import type { SearchFilters, SearchMode } from '@/hooks/useSearch';
import type { CaseType, CaseStatus } from '@legal-platform/types';

interface SearchFiltersPanelProps {
  filters: SearchFilters;
  searchMode: SearchMode;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onClearFilters: () => void;
  className?: string;
  collapsed?: boolean;
}

const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: 'Litigation', label: 'Litigiu' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Advisory', label: 'Consultanță' },
  { value: 'Criminal', label: 'Penal' },
  { value: 'Other', label: 'Altele' },
];

const CASE_STATUSES: { value: CaseStatus; label: string }[] = [
  { value: 'Active', label: 'Activ' },
  { value: 'PendingApproval', label: 'În așteptare aprobare' },
  { value: 'OnHold', label: 'În așteptare' },
  { value: 'Closed', label: 'Închis' },
  { value: 'Archived', label: 'Arhivat' },
];

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'Word (DOC)' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (DOCX)' },
  { value: 'application/vnd.ms-excel', label: 'Excel (XLS)' },
  { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (XLSX)' },
  { value: 'image/jpeg', label: 'Imagine JPEG' },
  { value: 'image/png', label: 'Imagine PNG' },
];

const SEARCH_MODES: { value: SearchMode; label: string; description: string }[] = [
  { value: 'HYBRID', label: 'Căutare inteligentă', description: 'Cele mai bune rezultate folosind AI + cuvinte cheie' },
  { value: 'FULL_TEXT', label: 'Căutare după cuvinte cheie', description: 'Potrivire exactă a cuvintelor cheie' },
  { value: 'SEMANTIC', label: 'Căutare AI', description: 'Găsește conținut similar' },
];

export function SearchFiltersPanel({
  filters,
  searchMode,
  onFiltersChange,
  onSearchModeChange,
  onClearFilters,
  className = '',
  collapsed = false,
}: SearchFiltersPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  // Count active filters
  const activeFilterCount = [
    filters.dateRange,
    filters.caseTypes?.length,
    filters.caseStatuses?.length,
    filters.documentTypes?.length,
  ].filter(Boolean).length;

  // Update date range filter
  const handleDateChange = (field: 'start' | 'end', value: string) => {
    const newDateRange = {
      start: filters.dateRange?.start || new Date(),
      end: filters.dateRange?.end || new Date(),
    };

    if (field === 'start') {
      newDateRange.start = new Date(value);
    } else {
      newDateRange.end = new Date(value);
    }

    onFiltersChange({
      ...filters,
      dateRange: newDateRange,
    });
  };

  // Toggle case type filter
  const toggleCaseType = (type: CaseType) => {
    const currentTypes = filters.caseTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];

    onFiltersChange({
      ...filters,
      caseTypes: newTypes.length > 0 ? newTypes : undefined,
    });
  };

  // Toggle case status filter
  const toggleCaseStatus = (status: CaseStatus) => {
    const currentStatuses = filters.caseStatuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];

    onFiltersChange({
      ...filters,
      caseStatuses: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  // Toggle document type filter
  const toggleDocumentType = (type: string) => {
    const currentTypes = filters.documentTypes || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];

    onFiltersChange({
      ...filters,
      documentTypes: newTypes.length > 0 ? newTypes : undefined,
    });
  };

  // Clear date range
  const clearDateRange = () => {
    onFiltersChange({
      ...filters,
      dateRange: undefined,
    });
  };

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="font-medium">Filtre</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Filter Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Search Mode */}
          <div className="pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mod de căutare
            </label>
            <div className="space-y-2">
              {SEARCH_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onSearchModeChange(mode.value)}
                  className={`w-full px-3 py-2 text-left rounded-lg border transition-colors ${
                    searchMode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">{mode.label}</div>
                  <div className="text-xs text-gray-500">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Interval de date
              </label>
              {filters.dateRange && (
                <button
                  onClick={clearDateRange}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Șterge
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="date"
                value={
                  filters.dateRange?.start
                    ? new Date(filters.dateRange.start).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <span className="text-gray-400 text-center text-xs">până la</span>
              <input
                type="date"
                value={
                  filters.dateRange?.end
                    ? new Date(filters.dateRange.end).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Case Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tip dosar
            </label>
            <div className="flex flex-wrap gap-2">
              {CASE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleCaseType(type.value)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.caseTypes?.includes(type.value)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Case Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status dosar
            </label>
            <div className="flex flex-wrap gap-2">
              {CASE_STATUSES.map((status) => (
                <button
                  key={status.value}
                  onClick={() => toggleCaseStatus(status.value)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.caseStatuses?.includes(status.value)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tip document
            </label>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleDocumentType(type.value)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    filters.documentTypes?.includes(type.value)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear All */}
          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              Șterge toate filtrele
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchFiltersPanel;
