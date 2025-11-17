/**
 * FilterBar Component
 * Filtering controls for time entries
 */

'use client';

import React from 'react';
import { useTimeTrackingStore } from '../../stores/time-tracking.store';
import type { TaskType } from '@legal-platform/types';

const taskTypes: { value: TimeTaskType; label: string }[] = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'Drafting', label: 'Redactare' },
  { value: 'ClientMeeting', label: 'Întâlnire Client' },
  { value: 'CourtAppearance', label: 'Prezentare Instanță' },
  { value: 'Email', label: 'Email' },
  { value: 'PhoneCall', label: 'Apel Telefonic' },
  { value: 'Administrative', label: 'Administrativ' },
  { value: 'Other', label: 'Altele' },
];

export function FilterBar() {
  const filters = useTimeTrackingStore((state) => state.filters);
  const setFilters = useTimeTrackingStore((state) => state.setFilters);
  const clearFilters = useTimeTrackingStore((state) => state.clearFilters);

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const activeFilterCount =
    (filters.dateRange ? 1 : 0) +
    filters.caseIds.length +
    filters.taskTypes.length +
    (filters.billableOnly ? 1 : 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Filtre
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showAdvanced ? 'Mai puține' : 'Mai multe'}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Curăță Filtre
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Billable Only */}
          <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.billableOnly}
              onChange={(e) =>
                setFilters({ billableOnly: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
            />
            <span className="text-sm text-gray-700">Doar Facturabile</span>
          </label>

          {/* Date Presets */}
          <button
            onClick={() => {
              const today = new Date();
              const start = new Date(today);
              start.setHours(0, 0, 0, 0);
              const end = new Date(today);
              end.setHours(23, 59, 59, 999);
              setFilters({ dateRange: { start, end } });
            }}
            className={`px-3 py-1.5 border rounded-md text-sm ${
              filters.dateRange ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Astăzi
          </button>

          <button
            onClick={() => {
              const today = new Date();
              const start = new Date(today);
              start.setDate(start.getDate() - 7);
              start.setHours(0, 0, 0, 0);
              const end = new Date(today);
              end.setHours(23, 59, 59, 999);
              setFilters({ dateRange: { start, end } });
            }}
            className={`px-3 py-1.5 border rounded-md text-sm ${
              filters.dateRange ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Ultima Săptămână
          </button>

          <button
            onClick={() => {
              const today = new Date();
              const start = new Date(today);
              start.setDate(start.getDate() - 30);
              start.setHours(0, 0, 0, 0);
              const end = new Date(today);
              end.setHours(23, 59, 59, 999);
              setFilters({ dateRange: { start, end } });
            }}
            className={`px-3 py-1.5 border rounded-md text-sm ${
              filters.dateRange ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Ultima Lună
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            {/* Task Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tip Activitate
              </label>
              <select
                value={filters.taskTypes[0] || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setFilters({ taskTypes: [e.target.value as TaskType] });
                  } else {
                    setFilters({ taskTypes: [] });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toate Tipurile</option>
                {taskTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Custom */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interval Personalizat
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={
                    filters.dateRange
                      ? new Date(filters.dateRange.start).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      const start = new Date(e.target.value);
                      const end = filters.dateRange?.end || new Date();
                      setFilters({ dateRange: { start, end } });
                    }
                  }}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={
                    filters.dateRange
                      ? new Date(filters.dateRange.end).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      const start = filters.dateRange?.start || new Date();
                      const end = new Date(e.target.value);
                      setFilters({ dateRange: { start, end } });
                    }
                  }}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
