/**
 * TaskFilterBar Component
 * Provides filtering options for task views (user assignment, status, priority, etc.)
 */

'use client';

import React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';
import type { TaskFilters } from '@legal-platform/types';
import { useFirmUsers } from '../../hooks/useFirmUsers';

/**
 * TaskFilterBar Props
 */
interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: Partial<TaskFilters>) => void;
  onClearFilters: () => void;
}

/**
 * TaskFilterBar Component
 */
export function TaskFilterBar({ filters, onFiltersChange, onClearFilters }: TaskFilterBarProps) {
  const { users: firmUsers } = useFirmUsers();
  const selectedUsers = filters.assignedTo || [];

  // Map firm users to display format
  const users = firmUsers.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    initials: `${user.firstName[0] || ''}${user.lastName[0] || ''}`.toUpperCase(),
  }));

  /**
   * Handle user checkbox toggle
   */
  const handleUserToggle = (userId: string) => {
    const isCurrentlySelected = selectedUsers.includes(userId);

    if (isCurrentlySelected) {
      // Remove user from filter
      const newUsers = selectedUsers.filter((id) => id !== userId);
      onFiltersChange({
        assignedTo: newUsers.length > 0 ? newUsers : undefined,
      });
    } else {
      // Add user to filter
      onFiltersChange({
        assignedTo: [...selectedUsers, userId],
      });
    }
  };

  /**
   * Check if any filters are active
   */
  const hasActiveFilters =
    (filters.assignedTo && filters.assignedTo.length > 0) ||
    (filters.types && filters.types.length > 0) ||
    (filters.statuses && filters.statuses.length > 0) ||
    (filters.priorities && filters.priorities.length > 0) ||
    filters.dateRange !== undefined ||
    (filters.searchQuery && filters.searchQuery.trim() !== '');

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Filter Section */}
        <div className="flex items-center gap-6">
          {/* User Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Filtru utilizatori:</span>
            <div className="flex items-center gap-3">
              {users.map((user) => {
                const isChecked = selectedUsers.includes(user.id);

                return (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 cursor-pointer group"
                    htmlFor={`user-filter-${user.id}`}
                  >
                    <Checkbox.Root
                      id={`user-filter-${user.id}`}
                      checked={isChecked}
                      onCheckedChange={() => handleUserToggle(user.id)}
                      className="w-5 h-5 rounded border-2 border-gray-300 bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-colors"
                    >
                      <Checkbox.Indicator className="flex items-center justify-center text-white">
                        <CheckIcon className="w-4 h-4" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors select-none">
                      {user.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Șterge filtre
          </button>
        )}
      </div>

      {/* Active Filter Summary */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Filtre active:</span>
          <div className="flex items-center gap-2">
            {selectedUsers.length > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
                <span>Utilizatori: {selectedUsers.length}</span>
                <button
                  onClick={() => onFiltersChange({ assignedTo: undefined })}
                  className="ml-1 hover:text-blue-900"
                  aria-label="Șterge filtru utilizatori"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskFilterBar;
