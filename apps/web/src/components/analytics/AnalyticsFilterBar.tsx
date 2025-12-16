/**
 * Analytics Filter Bar Component
 * Story 4.7: Task Analytics and Optimization - Task 28
 *
 * Provides date range, task type, and user filters for analytics dashboard.
 * AC: 7 - All analytics support filtering by date range, task type, and user
 */

'use client';

import React, { useState } from 'react';
import type { TaskType } from '@legal-platform/types';
import type { DateRangePreset, ExportFormat } from '../../stores/taskAnalyticsStore';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsFilterBarProps {
  // Date range
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;

  // Filters
  selectedTaskTypes: TaskType[];
  onTaskTypesChange: (types: TaskType[]) => void;
  selectedUserIds: string[];
  onUserIdsChange: (ids: string[]) => void;

  // Comparison
  comparisonEnabled: boolean;
  onComparisonToggle: () => void;

  // Export
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;

  // Reset
  onReset: () => void;

  // Available options
  availableUsers?: { id: string; name: string }[];
}

// ============================================================================
// Constants
// ============================================================================

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom' },
];

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'Research', label: 'Research' },
  { value: 'DocumentCreation', label: 'Document Creation' },
  { value: 'DocumentRetrieval', label: 'Document Retrieval' },
  { value: 'CourtDate', label: 'Court Date' },
  { value: 'Meeting', label: 'Meeting' },
  { value: 'BusinessTrip', label: 'Business Trip' },
];

// ============================================================================
// Component
// ============================================================================

export function AnalyticsFilterBar({
  preset,
  onPresetChange,
  dateRange,
  onDateRangeChange,
  selectedTaskTypes,
  onTaskTypesChange,
  selectedUserIds,
  onUserIdsChange,
  comparisonEnabled,
  onComparisonToggle,
  onExport,
  isExporting,
  onReset,
  availableUsers = [],
}: AnalyticsFilterBarProps) {
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const handleTaskTypeToggle = (type: TaskType) => {
    if (selectedTaskTypes.includes(type)) {
      onTaskTypesChange(selectedTaskTypes.filter((t) => t !== type));
    } else {
      onTaskTypesChange([...selectedTaskTypes, type]);
    }
  };

  const handleUserToggle = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onUserIdsChange(selectedUserIds.filter((id) => id !== userId));
    } else {
      onUserIdsChange([...selectedUserIds, userId]);
    }
  };

  const activeFiltersCount =
    selectedTaskTypes.length + selectedUserIds.length + (preset !== 'last30' ? 1 : 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Date Range Preset */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Period:</label>
          <select
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as DateRangePreset)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => onDateRangeChange({ ...dateRange, start: new Date(e.target.value) })}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => onDateRangeChange({ ...dateRange, end: new Date(e.target.value) })}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Task Type Filter */}
        <div className="relative">
          <button
            onClick={() => setShowTaskTypeDropdown(!showTaskTypeDropdown)}
            className={`text-sm border rounded-lg px-3 py-1.5 flex items-center gap-2 ${
              selectedTaskTypes.length > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            <span>Task Types</span>
            {selectedTaskTypes.length > 0 && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {selectedTaskTypes.length}
              </span>
            )}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showTaskTypeDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTaskTypeDropdown(false)} />
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-2 max-h-64 overflow-y-auto">
                {TASK_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskTypes.includes(type.value)}
                      onChange={() => handleTaskTypeToggle(type.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{type.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* User Filter */}
        {availableUsers.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className={`text-sm border rounded-lg px-3 py-1.5 flex items-center gap-2 ${
                selectedUserIds.length > 0
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <span>Users</span>
              {selectedUserIds.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {selectedUserIds.length}
                </span>
              )}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showUserDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-2 max-h-64 overflow-y-auto">
                  {availableUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{user.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Comparison Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={comparisonEnabled}
            onChange={onComparisonToggle}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Compare to previous period</span>
        </label>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset Button */}
        {activeFiltersCount > 0 && (
          <button onClick={onReset} className="text-sm text-gray-500 hover:text-gray-700">
            Reset filters
          </button>
        )}

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            disabled={isExporting}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Export</span>
              </>
            )}
          </button>
          {showExportDropdown && !isExporting && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportDropdown(false)} />
              <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-2">
                <button
                  onClick={() => {
                    onExport('csv');
                    setShowExportDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => {
                    onExport('pdf');
                    setShowExportDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Export as PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          {preset !== 'last30' && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center gap-1">
              {PRESETS.find((p) => p.value === preset)?.label}
              <button
                onClick={() => onPresetChange('last30')}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </span>
          )}
          {selectedTaskTypes.map((type) => (
            <span
              key={type}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1"
            >
              {TASK_TYPES.find((t) => t.value === type)?.label || type}
              <button
                onClick={() => handleTaskTypeToggle(type)}
                className="text-blue-400 hover:text-blue-600"
              >
                ×
              </button>
            </span>
          ))}
          {selectedUserIds.map((userId) => {
            const user = availableUsers.find((u) => u.id === userId);
            return (
              <span
                key={userId}
                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1"
              >
                {user?.name || userId}
                <button
                  onClick={() => handleUserToggle(userId)}
                  className="text-green-400 hover:text-green-600"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AnalyticsFilterBar;
