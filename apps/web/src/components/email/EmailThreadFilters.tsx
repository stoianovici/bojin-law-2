/**
 * Email Thread Filters Component
 * Story 5.1: Email Integration and Synchronization
 */

'use client';

import React from 'react';

interface Filters {
  hasUnread?: boolean;
  hasAttachments?: boolean;
  search?: string;
}

interface EmailThreadFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onRefresh: () => void;
}

export function EmailThreadFilters({
  filters,
  onChange,
  onRefresh,
}: EmailThreadFiltersProps) {
  return (
    <div className="border-b border-gray-200 p-3 dark:border-gray-700">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search emails..."
          value={filters.search || ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
      </div>

      {/* Filter toggles */}
      <div className="mt-2 flex flex-wrap gap-2">
        <FilterToggle
          label="Unread"
          active={filters.hasUnread === true}
          onClick={() =>
            onChange({
              ...filters,
              hasUnread: filters.hasUnread === true ? undefined : true,
            })
          }
        />
        <FilterToggle
          label="Has Attachments"
          active={filters.hasAttachments === true}
          onClick={() =>
            onChange({
              ...filters,
              hasAttachments: filters.hasAttachments === true ? undefined : true,
            })
          }
        />
        <button
          onClick={onRefresh}
          className="ml-auto text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
